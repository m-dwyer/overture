// Overture emulator host — installs the Schwung `shadow_ui` host shims as globals,
// then loads the REAL tool ui.js and drives it (init + ~94 Hz tick). Layout tier:
// display→canvas, LEDs→log, params→JS-mock DSP, MIDI→log, co-run→stub.
// See ../HOST-API.md for the contract this mirrors.

import { createMockDsp } from "./mock-dsp.js";

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
function setLED(idx: number, color: number): void { leds.set(idx, color); }
function setButtonLED(cc: number, color: number): void { buttonLeds.set(cc, color); }
function clearAllLEDs(): void { leds.clear(); }

// ---- Param shims (DSP bridge → layout-tier mock) -----------------------
const dsp = createMockDsp();
function hostModuleGetParam(key: string): string | null { return dsp.get(key); }
function hostModuleSetParam(key: string, val: string | number): void { dsp.set(key, val); }

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

  let ticks = 0;
  setStatus("running");
  setInterval(() => {
    try { globalThis.tick?.(); } catch (e) {
      if (ticks % 94 === 0) log("tick() threw: " + ((e as Error)?.message || e));
    }
    ticks++;
  }, 1000 / TICK_HZ);

  // Expose for console-driven input until the Move shell is wired.
  globalThis.OVT = {
    dsp, leds, buttonLeds,
    midiIn: (s: number, d1: number, d2: number) => globalThis.onMidiMessageInternal?.(s, d1, d2),
    midiExt: (s: number, d1: number, d2: number) => globalThis.onMidiMessageExternal?.(s, d1, d2),
  };
}

void boot();
