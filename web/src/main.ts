// Overture emulator host — installs the Schwung `shadow_ui` host shims as globals,
// then loads the REAL tool ui.js and drives it (init + ~94 Hz tick). Layout tier:
// display→canvas, LEDs→log, params→JS-mock DSP, MIDI→log, co-run→stub.
// See ../HOST-API.md for the contract this mirrors.

import { createMockDsp } from "./mock-dsp.js";
import { createWasmDsp } from "./wasm-dsp.js";
import { mountShell, type ShellLeds } from "./shell.js";
import type { Dsp } from "./dsp.js";

const TICK_HZ = 94; // device cadence (STEP_HOLD_TICKS is calibrated to this)

const canvas = document.getElementById("oled") as HTMLCanvasElement;
const ctx = canvas.getContext("2d")!;
const statusEl = document.getElementById("status")!;
const logEl = document.getElementById("log")!;

const OLED_W = 128, OLED_H = 64;
const FG = "#19f0a8", BG = "#001b14";

let logCount = 0;
function log(msg: string): void {
  if (logCount++ > 500) return; // cheap cap
  logEl.textContent += msg + "\n";
  logEl.scrollTop = logEl.scrollHeight;
}
function setStatus(msg: string): void { statusEl.textContent = msg; }

// ---- Display shims (1-bit 128×64 OLED → canvas) -------------------------
// Device contract (schwung/docs/API.md): color/value 0 = black, 1 = white.
// We render white→FG, black→BG (an OLED-green aesthetic; glyph fidelity is
// device-only per UX.md). Inverted UI (fill_rect …,1 then print …,0) therefore
// draws BG-coloured text on an FG bar — i.e. correct highlight inversion.
const FONT = "12px ui-monospace, 'SF Mono', Menlo, monospace";
function applyFont(): void { ctx.font = FONT; ctx.textBaseline = "top"; }
function shade(value: number | boolean): string { return value ? FG : BG; }

function clearScreen(): void {
  ctx.fillStyle = BG;
  ctx.fillRect(0, 0, OLED_W, OLED_H);
}
function fillRect(x: number, y: number, w: number, h: number, value: number | boolean): void {
  ctx.fillStyle = shade(value);
  ctx.fillRect(x | 0, y | 0, Math.max(0, w | 0), Math.max(0, h | 0));
}
function drawRect(x: number, y: number, w: number, h: number, value: number | boolean): void {
  ctx.fillStyle = shade(value);
  const X = x | 0, Y = y | 0, W = Math.max(0, w | 0), H = Math.max(0, h | 0);
  ctx.fillRect(X, Y, W, 1); ctx.fillRect(X, Y + H - 1, W, 1);
  ctx.fillRect(X, Y, 1, H); ctx.fillRect(X + W - 1, Y, 1, H);
}
function setPixel(x: number, y: number, value: number | boolean): void {
  ctx.fillStyle = shade(value);
  ctx.fillRect(x | 0, y | 0, 1, 1);
}
function print(x: number, y: number, text: unknown, color: number = 1): void {
  applyFont();
  ctx.fillStyle = color === 0 ? BG : FG; // color 0 = black (visible only over a white fill)
  ctx.fillText(String(text ?? ""), x | 0, y | 0);
}
function textWidth(text: unknown): number {
  applyFont();
  return Math.ceil(ctx.measureText(String(text ?? "")).width);
}
function hostFlushDisplay(): void { /* drawn eagerly; nothing to present */ }

// ---- LED shims (pad/step/button grid) ----------------------------------
const leds = new Map<number, number>();       // idx -> color
const buttonLeds = new Map<number, number>(); // cc  -> color
let shellLeds: ShellLeds | null = null;       // set once the shell mounts
function setLED(idx: number, color: number): void { leds.set(idx, color); shellLeds?.setLED(idx, color); }
function setButtonLED(cc: number, color: number): void { buttonLeds.set(cc, color); shellLeds?.setButtonLED(cc, color); }
function clearAllLEDs(): void { leds.clear(); shellLeds?.clearAll(); }
// The tool drives LEDs through the shared input_filter.setLED/setButtonLED, which
// emit USB-MIDI here: [0x09, NoteOn, note, color] = pad/step LED; [0x0b, CC, cc,
// color] = button LED. (ui.js routes real MIDI via inject/send_midi_to_dsp.)
function moveMidiInternalSend(pkt: number[]): void {
  const status = (pkt[1] ?? 0) & 0xf0, idx = pkt[2] ?? 0, color = pkt[3] ?? 0;
  if (status === 0x90) { leds.set(idx, color); shellLeds?.setLED(idx, color); }
  else if (status === 0xb0) { buttonLeds.set(idx, color); shellLeds?.setButtonLED(idx, color); }
}

// ---- Param shims (DSP bridge → layout-tier mock) -----------------------
let dsp: Dsp = createMockDsp(); // swapped for seq8-wasm in boot() unless ?mock is set
function hostModuleGetParam(key: string): string | null { return dsp.get(key); }
function hostModuleSetParam(key: string, val: string | number): void {
  if (key === "bpm") dsp.setBpm(Number(val)); // keep host get_bpm in sync with the UI
  dsp.set(key, val);
}

// ---- State persistence shims (→ localStorage) --------------------------
function hostWriteFile(path: string, data: string): number {
  try { localStorage.setItem("ovt:" + path, String(data)); return 1; } catch { return 0; }
}
function hostReadFile(path: string): string | null {
  return localStorage.getItem("ovt:" + path);
}
function hostFileExists(path: string): number { return localStorage.getItem("ovt:" + path) !== null ? 1 : 0; }
function hostEnsureDir(_path: string): number { return 1; } // virtual FS — dirs implicit
function hostRemoveDir(_path: string): number { return 1; }

// ---- MIDI out shims (stub/log) -----------------------------------------
function moveMidiInjectToMove(pkt: number[]): void { log("inject_to_move " + JSON.stringify(pkt)); }
function shadowSendMidiToDsp(...a: unknown[]): void { log("send_midi_to_dsp " + JSON.stringify(a)); }

// ---- co-run shims (stub editor) ----------------------------------------
function shadowCorunBegin(...a: unknown[]): void { log("corun_begin " + JSON.stringify(a)); setStatus("[co-run: native editor stub]"); }
function shadowCorunEnd(): void { log("corun_end"); setStatus("running"); }
function shadowGetUiFlags(): Record<string, unknown> { return {}; }

// ---- Install on globalThis BEFORE importing the tool -------------------
Object.assign(globalThis, {
  clear_screen: clearScreen,
  fill_rect: fillRect,
  draw_rect: drawRect,
  set_pixel: setPixel,
  print,
  text_width: textWidth,
  host_flush_display: hostFlushDisplay,
  setLED, setButtonLED, clearAllLEDs,
  move_midi_internal_send: moveMidiInternalSend,
  host_module_get_param: hostModuleGetParam,
  host_module_set_param: hostModuleSetParam,
  host_write_file: hostWriteFile,
  host_read_file: hostReadFile,
  host_file_exists: hostFileExists,
  host_ensure_dir: hostEnsureDir,
  host_remove_dir: hostRemoveDir,
  move_midi_inject_to_move: moveMidiInjectToMove,
  shadow_send_midi_to_dsp: shadowSendMidiToDsp,
  shadow_corun_begin: shadowCorunBegin,
  shadow_corun_end: shadowCorunEnd,
  shadow_get_ui_flags: shadowGetUiFlags,
});

// ---- Boot: load the REAL tool UI, then run the host loop ---------------
async function boot(): Promise<void> {
  clearScreen();

  // Behavior tier: load the real seq8 engine (wasm) unless ?mock is set. Must
  // happen before the UI's init() reads params.
  if (!new URLSearchParams(location.search).has("mock")) {
    try {
      dsp = await createWasmDsp((tag, b0, b1, b2, b3) => log(`dsp→midi [${tag}] ${b0} ${b1} ${b2} ${b3}`));
      log("dsp: seq8-wasm (behavior tier)");
    } catch (e) {
      log("seq8-wasm load failed — using mock: " + ((e as Error)?.message || e));
    }
  }

  try {
    // Resolved by the Vite import-remap plugin to tool/ui/ui.js. The `as string`
    // cast keeps the literal for Vite (post-transpile) while telling TS this is a
    // dynamic import to untyped JS (TS won't disk-resolve the on-device path).
    await import("/data/UserData/schwung/modules/tools/davebox/ui.js" as string);
  } catch (e) {
    setStatus("FAILED to load tool ui.js");
    log("import error: " + ((e as Error)?.stack || e));
    console.error(e);
    return;
  }

  try { globalThis.init?.(); } catch (e) { log("init() threw: " + ((e as Error)?.stack || e)); }

  // Mount the clickable Move hardware shell → onMidiMessageInternal([s,d1,d2]).
  const sendInternal = (status: number, d1: number, d2: number) =>
    globalThis.onMidiMessageInternal?.([status, d1, d2]);
  const shellRoot = document.getElementById("shell");
  if (shellRoot) {
    shellLeds = mountShell(shellRoot, sendInternal);
    // Replay LED state the tool set during init() (before the shell mounted).
    for (const [i, c] of leds) shellLeds.setLED(i, c);
    for (const [cc, c] of buttonLeds) shellLeds.setButtonLED(cc, c);
  }

  let ticks = 0;
  setStatus("running");
  const BLOCK_MS = (1000 * 128) / 44100; // one audio block of real time (~2.9ms)
  let lastRenderT = performance.now();
  setInterval(() => {
    // Pump the engine at real-time block rate before the UI reads state, so
    // playback/tempo advance correctly regardless of tick jitter.
    const now = performance.now();
    let blocks = Math.floor((now - lastRenderT) / BLOCK_MS);
    if (blocks > 16) { blocks = 16; lastRenderT = now; } // cap after a stall
    else { lastRenderT += blocks * BLOCK_MS; }
    for (let i = 0; i < blocks; i++) dsp.render();

    try { globalThis.tick?.(); } catch (e) {
      if (ticks % 94 === 0) log("tick() threw: " + ((e as Error)?.message || e));
    }
    ticks++;
  }, 1000 / TICK_HZ);

  // Expose for console-driven input until the Move shell is wired.
  globalThis.OVT = {
    dsp, leds, buttonLeds,
    midiIn: (s: number, d1: number, d2: number) => globalThis.onMidiMessageInternal?.([s, d1, d2]),
    midiExt: (s: number, d1: number, d2: number) => globalThis.onMidiMessageExternal?.([s, d1, d2]),
  };
}

void boot();
