import { CC, NAV, NOTE_ON, PAD_COUNT, PAD_NOTE0, type Send } from "../lib/move-controls";
import { type BrowserSchwungDiagnostics, type BrowserSchwungHost, createBrowserSchwungChain } from "../schwung/browser-chain";
import { createManualSchwungChain } from "../schwung/manual-catalog";
import { createEmulator, type Emulator } from "./emulator";
import { createGlobalOvtHarnessPort, createOvtHarnessHandle, type EmulatorHarnessPort } from "./emulator-harness";
import { pickDsp, startTickLoop } from "./emulator-runtime";
import { scheduleInitialState } from "./initial-state-driver";
import type { DisplaySink, FileStore, LedSink, MidiSink } from "./sinks";

export type BrowserHarnessDiagnostics = BrowserSchwungDiagnostics;

export interface BrowserHostPortOptions {
  display: DisplaySink;
  leds: LedSink;
  files: FileStore;
  ledState: {
    padsAndSteps: Map<number, number>;
    buttons: Map<number, number>;
  };
  manualMode: boolean;
  log(message: string): void;
  setStatus(message: string): void;
  notifyDiagnostics(diagnostics: BrowserSchwungDiagnostics): void;
  harnessPort?: EmulatorHarnessPort;
}

interface BrowserHostPorts {
  display: DisplaySink;
  files: FileStore;
  harness: EmulatorHarnessPort;
  ledState: {
    padsAndSteps: Map<number, number>;
    buttons: Map<number, number>;
  };
  leds: LedSink;
  log(message: string): void;
  midi: MidiSink;
  setStatus(message: string): void;
  schwung: {
    create(): Promise<BrowserSchwungHost>;
  };
}

export interface BrowserEmulatorHarnessOptions {
  host: BrowserHostPortOptions;
  initialState: {
    trackNumber: number | null;
    view: "note" | null;
  };
}

export interface BrowserEmulatorHarness {
  readonly send: Send;
  start(): Promise<void>;
  stop(): void;
  resetSchwungAudio(): void;
}

function createBrowserHostPorts(options: BrowserHostPortOptions): BrowserHostPorts {
  return {
    display: options.display,
    files: options.files,
    harness: options.harnessPort ?? createGlobalOvtHarnessPort(),
    ledState: options.ledState,
    leds: options.leds,
    log: options.log,
    midi: {
      inject: (packet) => options.log("inject_to_move " + JSON.stringify(packet)),
      toChain: (args) => options.log("send_midi_to_dsp " + JSON.stringify(args)),
    },
    setStatus: options.setStatus,
    schwung: {
      create() {
        const schwungOptions = {
          log: options.log,
          notify: options.notifyDiagnostics,
        };
        return options.manualMode
          ? createManualSchwungChain(schwungOptions)
          : createBrowserSchwungChain(schwungOptions);
      },
    },
  };
}

export function createBrowserEmulatorHarness(options: BrowserEmulatorHarnessOptions): BrowserEmulatorHarness {
  const ports = createBrowserHostPorts(options.host);
  let emu: Emulator | null = null;
  let schwung: BrowserSchwungHost | null = null;
  let stopLoop: (() => void) | undefined;
  let stopInitialState: (() => void) | undefined;
  let cancelled = false;

  const send: Send = (status, data1, data2) => {
    if (shouldPrimeSchwungAudio(status, data1, data2)) schwung?.primeAudioEngine();
    emu?.sendInternal(status, data1, data2);
  };

  async function start(): Promise<void> {
    ports.display.clearScreen();
    let nextSchwung: BrowserSchwungHost;
    try {
      nextSchwung = await ports.schwung.create();
    } catch (error) {
      ports.setStatus("FAILED to load Schwung modules");
      ports.log("schwung load error: " + ((error as Error)?.stack || error));
      return;
    }
    if (cancelled) return;
    schwung = nextSchwung;

    const dsp = await pickDsp(ports.log, nextSchwung);
    if (cancelled) return;

    let nextEmu: Emulator;
    try {
      nextEmu = await createEmulator({
        dsp,
        display: ports.display,
        leds: ports.leds,
        log: ports.log,
        midi: ports.midi,
        files: ports.files,
        schwung: nextSchwung,
      });
    } catch (error) {
      ports.setStatus("FAILED to load tool ui.js");
      ports.log("import error: " + ((error as Error)?.stack || error));
      return;
    }
    if (cancelled) return;
    emu = nextEmu;

    try {
      nextEmu.init();
    } catch (error) {
      ports.log("init() threw: " + ((error as Error)?.stack || error));
    }

    ports.setStatus("running");
    stopLoop = startTickLoop(nextEmu, ports.log);
    stopInitialState = scheduleInitialState(nextEmu, options.initialState);
    ports.harness.publish(
      createOvtHarnessHandle({
        emu: nextEmu,
        dsp,
        leds: ports.ledState.padsAndSteps,
        buttonLeds: ports.ledState.buttons,
        schwung: nextSchwung,
      }),
    );
  }

  function stop(): void {
    cancelled = true;
    stopInitialState?.();
    stopLoop?.();
    ports.harness.clear();
  }

  function resetSchwungAudio(): void {
    schwung?.resetAudioEngine();
  }

  return { send, start, stop, resetSchwungAudio };
}

function shouldPrimeSchwungAudio(status: number, data1: number, data2: number): boolean {
  const message = status & 0xf0;
  if (message === CC) return data1 === NAV.Play && data2 > 0;
  if (message !== NOTE_ON || data2 <= 0) return false;
  return data1 >= PAD_NOTE0 && data1 < PAD_NOTE0 + PAD_COUNT;
}
