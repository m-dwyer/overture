// Headless test harness: the REAL tool ui.js + real seq8-wasm engine, driven via
// recorder sinks (no DOM/canvas). Gestures read like Move choreography; assertions
// hit engine truth (get_param), emitted MIDI, recorded OLED print() calls, and LEDs.
import { createEmulator, type Emulator } from "../../src/host/emulator.js";
import { createWasmDsp } from "../../src/wasm-dsp.js";
import { memFiles, type DisplaySink, type LedSink, type FileStore } from "../../src/host/sinks.js";

export interface PrintCall { x: number; y: number; text: string; color: number; }

export interface Recorder {
  prints: PrintCall[];
  leds: Map<number, number>;
  buttonLeds: Map<number, number>;
  midiOut: number[][]; // engine-emitted [tag, b0, b1, b2, b3]
  display: DisplaySink;
  ledSink: LedSink;
  /** Text printed in the current OLED frame (since the last clear). */
  text(): string;
  litLeds(): number;
}

function recorder(): Recorder {
  const prints: PrintCall[] = [];
  const leds = new Map<number, number>();
  const buttonLeds = new Map<number, number>();
  const midiOut: number[][] = [];
  const display: DisplaySink = {
    clearScreen() { prints.length = 0; }, // new frame
    fillRect() {}, drawRect() {}, setPixel() {},
    print(x, y, text, color) { prints.push({ x, y, text, color }); },
    textWidth(t) { return t.length * 6; },
    flush() {},
  };
  const ledSink: LedSink = {
    setLED(i, c) { leds.set(i, c); },
    setButtonLED(cc, c) { buttonLeds.set(cc, c); },
    clearAll() { leds.clear(); buttonLeds.clear(); },
  };
  return {
    prints, leds, buttonLeds, midiOut, display, ledSink,
    text() { return prints.map((p) => p.text).join(" "); },
    litLeds() {
      let n = 0;
      for (const c of leds.values()) if (c > 0) n++;
      for (const c of buttonLeds.values()) if (c > 0) n++;
      return n;
    },
  };
}

/** The Overture UI state object (S), exposed via the emulator test hook. Engine
 * truth comes from get(); this is for UI-mode behaviour with no DSP read-back
 * (active track/bank/clip, view toggles). Common fields typed; rest open. */
export interface UiState {
  activeTrack: number;
  activeBank: number;
  sessionView: boolean;
  moveCoRunTrack: number;
  schwungCoRunSlot: number;
  pendingEditSoundEntry: unknown | null;
  trackActiveBank: number[];
  trackActiveClip: number[];
  trackChannel: number[];
  trackRoute: number[];
  trackPadMode: number[];
  trackOctave: number[];
  trackAtMode: number[];
  padLayoutChromatic: boolean[];
  beatMarkersEnabled: boolean;
  actionPopupLines: string[];
  trackClipPlaying: boolean[];
  trackQueuedClip: number[];
  drumClipNonEmpty: boolean[][];
  activeDrumLane: number[];
  trackCCType: number[][];
  trackCCAssign: number[][];
  trackCCAutoBits: number[][];
  clipCCVal: number[][][];
  ccLaneLength: number[][][];
  ccLaneTps: number[][][];
  ccLaneResTps: number[][][];
  [key: string]: unknown;
}

declare global {
  var overtureUiState: UiState | undefined;
}

export interface Harness {
  emu: Emulator;
  rec: Recorder;
  /** Run n tick + render cycles (lets deferred gestures settle). */
  step(n?: number): void;
  cc(cc: number, val: number): void;
  press(cc: number): void; // 127, tick, 0, tick
  hold(cc: number): void;
  release(cc: number): void;
  pad(idx: number, vel?: number): void;
  /** Tap a step button (NOTE 16..31): on, tick, off, tick. */
  tapStep(i: number): void;
  encoder(k: number, dir: 1 | -1): void;
  get(key: string): string | null;
  set(key: string, val: string | number): void;
  /** Live Overture UI state (S) — see UiState. */
  ui(): UiState;
  /** The in-memory host FileStore (state files / sidecar / snapshots). */
  files: FileStore;
  /** Suspend gesture: Shift+Back. Writes the UI sidecar synchronously and
   * defers the DSP `save`; the steps here drain that deferred save. */
  suspend(): void;
  /** Resume: re-run init() in the same runtime (Move's Shift+Back resume
   * model) so restoreUiSidecar re-reads the sidecar, then settle. */
  resume(n?: number): void;
  /** Open the global menu (Shift+NoteSession, CC 49+50). */
  menuOpen(): void;
  /** Move the open menu's selection to the item with this label (by label, like
   * the production jumpToMenuLabel shortcut). Throws if not found. */
  menuSelect(label: string): void;
  /** Jog-wheel click (CC 3) — activates the selected menu item / confirms a dialog. */
  jogClick(): void;
  /** Jog-wheel rotate one detent (CC 14); dir>0 = CW. Toggles Yes/No in confirms. */
  jogTurn(dir: 1 | -1): void;
}

const BLOCKS_PER_TICK = 4;

export async function createHarness(): Promise<Harness> {
  const rec = recorder();
  const files = memFiles();
  const dsp = await createWasmDsp((tag, b0, b1, b2, b3) => rec.midiOut.push([tag, b0, b1, b2, b3]));
  const emu = await createEmulator({ dsp, display: rec.display, leds: rec.ledSink, files });
  emu.init();

  const step = (n = 1): void => {
    for (let i = 0; i < n; i++) { emu.renderBlocks(BLOCKS_PER_TICK); emu.tick(); }
  };
  step(400); // clear the splash, settle into the main view

  const cc = (c: number, v: number): void => { emu.sendInternal(0xb0, c, v); };
  return {
    emu, rec, step, cc,
    press(c) { emu.sendInternal(0xb0, c, 127); step(1); emu.sendInternal(0xb0, c, 0); step(1); },
    hold(c) { emu.sendInternal(0xb0, c, 127); },
    release(c) { emu.sendInternal(0xb0, c, 0); },
    pad(idx, vel = 110) { emu.sendInternal(0x90, 68 + idx, vel); step(1); emu.sendInternal(0x80, 68 + idx, 0); step(1); },
    tapStep(i) { emu.sendInternal(0x90, 16 + i, 127); step(1); emu.sendInternal(0x80, 16 + i, 0); step(1); },
    encoder(k, dir) { emu.sendInternal(0xb0, 71 + k, dir === 1 ? 1 : 127); step(1); },
    get(key) { return emu.dsp.get(key); },
    set(key, val) { emu.dsp.set(key, val); },
    ui() {
      const state = globalThis.overtureUiState;
      if (!state) throw new Error("overtureUiState is not initialized");
      return state;
    },
    files,
    suspend() {
      emu.sendInternal(0xb0, 49, 127); // Shift down (MoveShift)
      emu.sendInternal(0xb0, 51, 127); // Back press → saveState() under Shift
      step(1);
      emu.sendInternal(0xb0, 51, 0);
      emu.sendInternal(0xb0, 49, 0);   // Shift up
      step(2); // drain pendingSuspendSave (DSP `save`) + pendingHideAfterSave
    },
    resume(n = 400) { emu.init(); step(n); },
    menuOpen() {
      emu.sendInternal(0xb0, 49, 127);  // Shift down
      emu.sendInternal(0xb0, 50, 127);  // NoteSession press → openGlobalMenu under Shift
      step(1);
      emu.sendInternal(0xb0, 50, 0);
      emu.sendInternal(0xb0, 49, 0);    // Shift up
      step(1);
    },
    menuSelect(label) {
      const st = globalThis.overtureUiState as UiState | undefined;
      const items = st?.globalMenuItems as Array<{ label?: string }> | undefined;
      const state = st?.globalMenuState as { selectedIndex: number } | undefined;
      if (!items || !state) throw new Error("global menu is not open");
      const idx = items.findIndex((it) => it && it.label === label);
      if (idx < 0) throw new Error(`menu item not found: ${label}`);
      state.selectedIndex = idx;
    },
    jogClick() { emu.sendInternal(0xb0, 3, 127); step(1); },
    jogTurn(dir) { emu.sendInternal(0xb0, 14, dir > 0 ? 1 : 127); step(1); },
  };
}
