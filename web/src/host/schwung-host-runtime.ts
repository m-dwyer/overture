import {
  BrowserSchwungChain,
  type BrowserSchwungHost,
  createBrowserSchwungChain,
} from "../schwung/browser-chain.js";
import {
  createSchwungHostApi,
  type SchwungHostApi,
} from "./shadow-ui-schwung-host.js";
import type { MidiSink } from "./sinks.js";

export interface SchwungHostRuntimeOptions {
  schwung?: BrowserSchwungHost;
  midi: MidiSink;
  log(message: string): void;
}

export interface SchwungHostRuntime {
  readonly api: SchwungHostApi["api"];
  readonly host: BrowserSchwungHost;
  handleHostInternalMidi(status: number, d1: number, d2: number): boolean;
}

export async function createSchwungHostRuntime(
  options: SchwungHostRuntimeOptions,
): Promise<SchwungHostRuntime> {
  const host =
    options.schwung ?? (await createSchwungHostWithFallback(options.log));
  const hostApi = createSchwungHostApi(host, options.midi, options.log);
  return {
    api: hostApi.api,
    host,
    handleHostInternalMidi: hostApi.handleHostInternalMidi,
  };
}

async function createSchwungHostWithFallback(
  log: (message: string) => void,
): Promise<BrowserSchwungHost> {
  try {
    return await createBrowserSchwungChain({ log });
  } catch (error) {
    log("schwung catalog load failed: " + ((error as Error)?.message || error));
    return new BrowserSchwungChain({ modules: [] }, { log, audioEngine: null });
  }
}
