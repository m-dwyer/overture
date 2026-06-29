import { createMockDsp } from "../../src/mock-dsp.js";
import { createEmulator, type Emulator } from "../../src/host/emulator.js";
import { memFiles, type DisplaySink, type FileStore, type LedSink, type MidiSink } from "../../src/host/sinks.js";
import { createDefaultTestSchwungChain } from "./schwung-catalog.js";

const BLOCKS_PER_TICK = 4;

export interface PrintCall {
  x: number;
  y: number;
  text: string;
  color: number;
}

export interface RectCall {
  kind: "fill" | "draw";
  x: number;
  y: number;
  w: number;
  h: number;
  value: number | boolean;
}

export interface PixelCall {
  x: number;
  y: number;
  value: number | boolean;
}

export interface OledFrame {
  text: string;
  prints: PrintCall[];
  rects: RectCall[];
  pixels: PixelCall[];
}

export interface Recorder {
  prints: PrintCall[];
  rects: RectCall[];
  pixels: PixelCall[];
  leds: Map<number, number>;
  buttonLeds: Map<number, number>;
  moveMidi: number[][];
  schwungMidi: unknown[][];
  display: DisplaySink;
  ledSink: LedSink;
  text(): string;
  litLedCount(): number;
}

export interface OvertureState {
  activeTrack: number;
  selectedTrackIndex: number;
  sessionView: boolean;
  playing: boolean;
  selectedStep: number;
  steps: Array<{ index: number; active: boolean; selected: boolean; playhead: boolean }>;
  [key: string]: unknown;
}

declare global {
  var overtureUiState: OvertureState | undefined;
  var overtureRuntime: { isReady(): boolean } | undefined;
}

export interface Harness {
  emu: Emulator;
  rec: Recorder;
  files: FileStore;
  step(ticks?: number): void;
  cc(cc: number, value: number): void;
  note(status: number, note: number, velocity: number): void;
  pressCc(cc: number): void;
  tapNote(note: number, velocity?: number): void;
  state(): OvertureState;
  snapshot(): OledFrame;
}

function createRecorder(): Recorder {
  const prints: PrintCall[] = [];
  const rects: RectCall[] = [];
  const pixels: PixelCall[] = [];
  const leds = new Map<number, number>();
  const buttonLeds = new Map<number, number>();
  const moveMidi: number[][] = [];
  const schwungMidi: unknown[][] = [];
  const display: DisplaySink = {
    clearScreen() {
      prints.length = 0;
      rects.length = 0;
      pixels.length = 0;
    },
    fillRect(x, y, w, h, value) {
      rects.push({ kind: "fill", x, y, w, h, value });
    },
    drawRect(x, y, w, h, value) {
      rects.push({ kind: "draw", x, y, w, h, value });
    },
    setPixel(x, y, value) {
      pixels.push({ x, y, value });
    },
    print(x, y, text, color) {
      prints.push({ x, y, text, color });
    },
    textWidth(text) {
      return text.length * 6;
    },
    flush() {},
  };
  const ledSink: LedSink = {
    setLED(index, color) {
      leds.set(index, color);
    },
    setButtonLED(cc, color) {
      buttonLeds.set(cc, color);
    },
    clearAll() {
      leds.clear();
      buttonLeds.clear();
    },
  };
  return {
    prints,
    rects,
    pixels,
    leds,
    buttonLeds,
    moveMidi,
    schwungMidi,
    display,
    ledSink,
    text() {
      return prints.map((print) => print.text).join(" ");
    },
    litLedCount() {
      let lit = 0;
      for (const color of leds.values()) if (color > 0) lit++;
      for (const color of buttonLeds.values()) if (color > 0) lit++;
      return lit;
    },
  };
}

export async function createHarness(): Promise<Harness> {
  const rec = createRecorder();
  const files = memFiles();
  const schwung = await createDefaultTestSchwungChain();
  const emu = await createEmulator({
    dsp: createMockDsp(),
    display: rec.display,
    leds: rec.ledSink,
    files,
    schwung,
    midi: createRecordingMidiSink(rec),
  });

  emu.init();
  const step = (ticks = 1): void => {
    for (let i = 0; i < ticks; i++) {
      emu.renderBlocks(BLOCKS_PER_TICK);
      emu.tick();
    }
  };
  step(60);

  function state(): OvertureState {
    const current = globalThis.overtureUiState;
    if (!current) throw new Error("overtureUiState is not initialized");
    return current;
  }

  return {
    emu,
    rec,
    files,
    step,
    cc(cc, value) {
      emu.sendInternal(0xb0, cc, value);
    },
    note(status, note, velocity) {
      emu.sendInternal(status, note, velocity);
    },
    pressCc(cc) {
      emu.sendInternal(0xb0, cc, 127);
      step(1);
      emu.sendInternal(0xb0, cc, 0);
      step(1);
    },
    tapNote(note, velocity = 110) {
      emu.sendInternal(0x90, note, velocity);
      step(1);
      emu.sendInternal(0x80, note, 0);
      step(1);
    },
    state,
    snapshot() {
      emu.tick();
      return {
        text: rec.text(),
        prints: rec.prints.slice(),
        rects: rec.rects.slice(),
        pixels: rec.pixels.slice(),
      };
    },
  };
}

function createRecordingMidiSink(rec: Recorder): MidiSink {
  return {
    sendToMove(packet) {
      rec.moveMidi.push([...packet]);
    },
    sendToSchwungChain(message) {
      rec.schwungMidi.push([...message]);
    },
  };
}
