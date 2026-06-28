import type { Dsp } from "../dsp";
import type { BrowserSchwungHost } from "../schwung/browser-chain";
import type { Emulator } from "./emulator";

const TICK_HZ = 94;
const BLOCK_MS = (1000 * 128) / 44100;
const BLOCKS_PER_TICK = Math.round(1000 / TICK_HZ / BLOCK_MS);

export interface OvtHarnessHandle {
  dsp: Dsp;
  leds: Map<number, number>;
  buttonLeds: Map<number, number>;
  schwung?: BrowserSchwungHost;
  midiIn(status: number, data1: number, data2: number): void;
  midiExt(status: number, data1: number, data2: number): void;
  advanceTicks(ticks?: number): void;
}

export interface EmulatorHarnessPort {
  publish(handle: OvtHarnessHandle): void;
  clear(): void;
}

export function createOvtHarnessHandle({
  emu,
  dsp,
  leds,
  buttonLeds,
  schwung,
}: {
  emu: Emulator;
  dsp: Dsp;
  leds: Map<number, number>;
  buttonLeds: Map<number, number>;
  schwung?: BrowserSchwungHost;
}): OvtHarnessHandle {
  return {
    dsp,
    leds,
    buttonLeds,
    schwung,
    midiIn: (status, data1, data2) => emu.sendInternal(status, data1, data2),
    midiExt: (status, data1, data2) => emu.sendExternal(status, data1, data2),
    advanceTicks: (ticks = 1) => {
      for (let i = 0; i < ticks; i++) {
        emu.renderBlocks(BLOCKS_PER_TICK);
        emu.tick();
      }
    },
  };
}

export function createGlobalOvtHarnessPort(target: typeof globalThis = globalThis): EmulatorHarnessPort {
  return {
    publish(handle) {
      target.OVT = handle;
    },
    clear() {
      target.OVT = undefined;
    },
  };
}
