// Browser binding of the emulator core: wires the host sinks to the OLED canvas
// and the clickable Move shell, picks the DSP (real seq8-wasm, or the JS mock via
// ?mock), and runs the ~94 Hz loop + audio-block render pump. The host contract
// lives in the core (host/emulator.ts); this file is just the browser surface.
import { createEmulator } from "./host/emulator.js";
import type { DisplaySink, LedSink, FileStore } from "./host/sinks.js";
import { createMockDsp } from "./mock-dsp.js";
import { createWasmDsp } from "./wasm-dsp.js";
import { mountShell, type ShellLeds } from "./shell.js";
import type { Dsp } from "./dsp.js";

const TICK_HZ = 94;
const BLOCK_MS = (1000 * 128) / 44100; // one audio block of real time (~2.9ms)
const OLED_W = 128, OLED_H = 64;
const FG = "#19f0a8", BG = "#001b14";
const FONT = "12px ui-monospace, 'SF Mono', Menlo, monospace";

const canvas = document.getElementById("oled") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;
const logEl = document.getElementById("log")!;

let logCount = 0;
function log(msg: string): void {
  if (logCount++ > 500) return;
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}
const setStatus = (m: string): void => { statusEl.textContent = m; };

// ---- Canvas display sink (1-bit OLED; color/value 0=black, 1=white → BG/FG) ---
const shade = (v: number | boolean): string => (v ? FG : BG);
const display: DisplaySink = {
  clearScreen() { ctx.fillStyle = BG; ctx.fillRect(0, 0, OLED_W, OLED_H); },
  fillRect(x, y, w, h, v) { ctx.fillStyle = shade(v); ctx.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0)); },
  drawRect(x, y, w, h, v) {
    ctx.fillStyle = shade(v);
    const X = x | 0, Y = y | 0, W = Math.max(0, w | 0), H = Math.max(0, h | 0);
    ctx.fillRect(X, Y, W, 1); ctx.fillRect(X, Y + H - 1, W, 1);
    ctx.fillRect(X, Y, 1, H); ctx.fillRect(X + W - 1, Y, 1, H);
  },
  setPixel(x, y, v) { ctx.fillStyle = shade(v); ctx.fillRect(x | 0, y | 0, 1, 1); },
  print(x, y, text, color) {
    ctx.font = FONT; ctx.textBaseline = "top";
    ctx.fillStyle = color === 0 ? BG : FG;
    ctx.fillText(text, x | 0, y | 0);
  },
  textWidth(text) { ctx.font = FONT; return Math.ceil(ctx.measureText(text).width); },
  flush() { /* drawn eagerly */ },
};

// ---- LED sink → shell (records maps for OVT + replay before the shell mounts) --
const leds = new Map<number, number>();
const buttonLeds = new Map<number, number>();
let shellLeds: ShellLeds | null = null;
const ledSink: LedSink = {
  setLED(i, c) { leds.set(i, c); shellLeds?.setLED(i, c); },
  setButtonLED(cc, c) { buttonLeds.set(cc, c); shellLeds?.setButtonLED(cc, c); },
  clearAll() { leds.clear(); shellLeds?.clearAll(); },
};

// ---- File store → localStorage --------------------------------------------
const files: FileStore = {
  read: (p) => localStorage.getItem("ovt:" + p),
  write: (p, d) => { try { localStorage.setItem("ovt:" + p, String(d)); return 1; } catch { return 0; } },
  exists: (p) => localStorage.getItem("ovt:" + p) !== null,
};

async function boot(): Promise<void> {
  display.clearScreen();

  // Behavior tier: real seq8 engine unless ?mock is set.
  let dsp: Dsp = createMockDsp();
  if (!new URLSearchParams(location.search).has("mock")) {
    try {
      dsp = await createWasmDsp((tag, b0, b1, b2, b3) => log(`dsp→midi [${tag}] ${b0} ${b1} ${b2} ${b3}`));
      log("dsp: seq8-wasm (behavior tier)");
    } catch (e) {
      log("seq8-wasm load failed — using mock: " + ((e as Error)?.message || e));
    }
  }

  let emu;
  try {
    emu = await createEmulator({
      dsp, display, leds: ledSink, log,
      midi: { inject: (p) => log("inject_to_move " + JSON.stringify(p)), toChain: (a) => log("send_midi_to_dsp " + JSON.stringify(a)) },
      files,
    });
  } catch (e) {
    setStatus("FAILED to load tool ui.js");
    log("import error: " + ((e as Error)?.stack || e));
    return;
  }

  try { emu.init(); } catch (e) { log("init() threw: " + ((e as Error)?.stack || e)); }

  // Mount the clickable shell now that sendInternal exists; replay any LEDs the
  // tool set during init().
  const shellRoot = document.getElementById("shell");
  if (shellRoot) {
    shellLeds = mountShell(shellRoot, (s, d1, d2) => emu!.sendInternal(s, d1, d2));
    for (const [i, c] of leds) shellLeds.setLED(i, c);
    for (const [cc, c] of buttonLeds) shellLeds.setButtonLED(cc, c);
  }

  setStatus("running");
  let ticks = 0, lastRenderT = performance.now();
  setInterval(() => {
    const now = performance.now();
    let blocks = Math.floor((now - lastRenderT) / BLOCK_MS);
    if (blocks > 16) { blocks = 16; lastRenderT = now; } else { lastRenderT += blocks * BLOCK_MS; }
    emu!.renderBlocks(blocks);
    try { emu!.tick(); } catch (e) { if (ticks % 94 === 0) log("tick() threw: " + ((e as Error)?.message || e)); }
    ticks++;
  }, 1000 / TICK_HZ);

  // Console-driven input until you click the shell.
  globalThis.OVT = {
    dsp, leds, buttonLeds,
    midiIn: (s: number, d1: number, d2: number) => emu!.sendInternal(s, d1, d2),
    midiExt: (s: number, d1: number, d2: number) => emu!.sendExternal(s, d1, d2),
  };
}

void boot();
