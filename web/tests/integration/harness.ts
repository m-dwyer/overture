// Headless test harness: the REAL tool ui.js + real seq8-wasm engine, driven via
// recorder sinks (no DOM/canvas). Gestures read like Move choreography; assertions
// hit engine truth (get_param), emitted MIDI, recorded OLED print() calls, and LEDs.
import { createEmulator, type Emulator } from "../../src/host/emulator.js";
import { createWasmDsp } from "../../src/wasm-dsp.js";
import type { DisplaySink, LedSink } from "../../src/host/sinks.js";

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
  encoder(k: number, dir: 1 | -1): void;
  get(key: string): string | null;
}

const BLOCKS_PER_TICK = 4;

export async function createHarness(): Promise<Harness> {
  const rec = recorder();
  const dsp = await createWasmDsp((tag, b0, b1, b2, b3) => rec.midiOut.push([tag, b0, b1, b2, b3]));
  const emu = await createEmulator({ dsp, display: rec.display, leds: rec.ledSink });
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
    encoder(k, dir) { emu.sendInternal(0xb0, 71 + k, dir === 1 ? 1 : 127); step(1); },
    get(key) { return emu.dsp.get(key); },
  };
}
