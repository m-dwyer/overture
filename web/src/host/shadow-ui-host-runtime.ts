import type { Dsp } from "../dsp.js";
import type { BrowserSchwungHost } from "../schwung/browser-chain.js";
import type { HostApi } from "../host-api.js";
import { createDisplayHostApi } from "./shadow-ui-display-host.js";
import { createDspHostApi, type DspHostApi } from "./shadow-ui-dsp-host.js";
import { createFileHostApi } from "./shadow-ui-file-host.js";
import { createLedHostApi } from "./shadow-ui-led-host.js";
import { createSchwungHostRuntime, type SchwungHostRuntime } from "./schwung-host-runtime.js";
import type { DisplaySink, FileStore, LedSink, MidiSink } from "./sinks.js";

type HostGlobalTarget = typeof globalThis & Partial<HostApi>;

export interface ShadowUiHostRuntimeOptions {
  display: DisplaySink;
  dsp: Dsp;
  files: FileStore;
  leds: LedSink;
  log(message: string): void;
  midi: MidiSink;
  schwung?: BrowserSchwungHost;
  strict: boolean;
}

export interface ShadowUiHostRuntime {
  readonly dspHost: DspHostApi;
  readonly schwungHost: SchwungHostRuntime;
  installGlobals(target?: HostGlobalTarget): void;
}

export async function createShadowUiHostRuntime(options: ShadowUiHostRuntimeOptions): Promise<ShadowUiHostRuntime> {
  const dspHost = createDspHostApi(options.dsp, options.strict);
  const schwungHost = await createSchwungHostRuntime({
    schwung: options.schwung,
    midi: options.midi,
    log: options.log,
  });
  const globals: Partial<HostApi> = {
    ...createDisplayHostApi(options.display),
    ...createLedHostApi(options.leds),
    ...dspHost.api,
    ...createFileHostApi(options.files),
    ...schwungHost.api,
  };

  return {
    dspHost,
    schwungHost,
    installGlobals(target: HostGlobalTarget = globalThis) {
      Object.assign(target, globals);
    },
  };
}
