// Headless emulator core: installs the Schwung `shadow_ui` host shims (as globals)
// around pluggable sinks + a DSP, loads the REAL tool ui.js, and exposes a small
// drive surface (init/tick/renderBlocks/sendInternal). No DOM — the browser shell
// and the test harness are just different bindings of the same core.
import type { Dsp } from "../dsp.js";
import type { BrowserSchwungHost } from "../schwung/browser-chain.js";
import { createShadowUiHostRuntime } from "./shadow-ui-host-runtime.js";
import {
  type DisplaySink,
  type LedSink,
  type MidiSink,
  type FileStore,
  memFiles,
} from "./sinks.js";

export interface EmulatorOptions {
  dsp: Dsp;
  display: DisplaySink;
  leds: LedSink;
  /** Opt-in fidelity shims for device-host edge cases. Default keeps friendly host behavior. */
  strict?: boolean;
  midi?: MidiSink;
  files?: FileStore;
  schwung?: BrowserSchwungHost;
  log?: (msg: string) => void;
}

export interface Emulator {
  init(): void;
  tick(): void;
  /** Pump the engine n audio blocks (advances playback/automation). */
  renderBlocks(n: number): void;
  sendInternal(status: number, d1: number, d2: number): void;
  sendExternal(status: number, d1: number, d2: number): void;
  readonly dsp: Dsp;
}

export async function createEmulator(opts: EmulatorOptions): Promise<Emulator> {
  const { dsp, display, leds } = opts;
  const strict = opts.strict ?? false;
  const log = opts.log ?? (() => {});
  const files = opts.files ?? memFiles();
  const midi: MidiSink = opts.midi ?? {
    sendToMove: () => {},
    sendToSchwungChain: () => {},
  };
  const hostRuntime = await createShadowUiHostRuntime({
    display,
    dsp,
    files,
    leds,
    log,
    midi,
    schwung: opts.schwung,
    strict,
  });
  hostRuntime.installGlobals();

  // Load the real tool UI. The literal lets Vite's remap plugin (and vitest)
  // rewrite the on-device path to overture-next/ui/ui.js; `as string` tells TS
  // it's untyped JS. Must stay an inline literal because Vite can't analyze a
  // variable import here.
  await import("/data/UserData/schwung/modules/tools/overture/ui.js" as string);

  return {
    init() {
      globalThis.init?.();
    },
    tick() {
      // Strict mode treats each tick as the harness's simulated audio-buffer
      // boundary. Writes queued before the tick become DSP truth at tick start;
      // writes emitted by tick() are coalesced together and closed at tick end so
      // the existing render-before-tick harness step observes post-tick truth.
      if (strict) hostRuntime.dspHost.flushSetParams();
      globalThis.tick?.();
      if (strict) hostRuntime.dspHost.flushSetParams();
    },
    renderBlocks(n: number) {
      for (let i = 0; i < n; i++) dsp.render();
    },
    sendInternal(status, d1, d2) {
      if (hostRuntime.schwungHost.handleHostInternalMidi(status, d1, d2))
        return;
      globalThis.onMidiMessageInternal?.([status, d1, d2]);
    },
    sendExternal(status, d1, d2) {
      globalThis.onMidiMessageExternal?.([status, d1, d2]);
    },
    dsp,
  };
}
