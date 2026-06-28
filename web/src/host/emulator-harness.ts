import type { Dsp } from "../dsp";
import type { BrowserSchwungHost } from "../schwung/browser-chain";
import { createGlobalBrowserObservability } from "./browser-observability";
import type { Emulator } from "./emulator";

const TICK_HZ = 94;
const BLOCK_MS = (1000 * 128) / 44100;
const BLOCKS_PER_TICK = Math.round(1000 / TICK_HZ / BLOCK_MS);

export interface OvtHarnessHandle {
  readonly drive: OvtHarnessDrive;
  readonly inspection: OvtHarnessInspection;
  /** @deprecated Use `inspection.dsp`. */
  dsp: Dsp;
  /** @deprecated Use `inspection.leds`. */
  leds: Map<number, number>;
  /** @deprecated Use `inspection.buttonLeds`. */
  buttonLeds: Map<number, number>;
  /** @deprecated Use `inspection.schwung`. */
  schwung?: BrowserSchwungHost;
  midiIn(status: number, data1: number, data2: number): void;
  midiExt(status: number, data1: number, data2: number): void;
  advanceTicks(ticks?: number): void;
}

export interface OvtHarnessDrive {
  midiIn(status: number, data1: number, data2: number): void;
  midiExt(status: number, data1: number, data2: number): void;
  advanceTicks(ticks?: number): void;
}

export interface OvtHarnessInspection {
  dsp: Dsp;
  leds: Map<number, number>;
  buttonLeds: Map<number, number>;
  schwung?: BrowserSchwungHost;
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
  const drive: OvtHarnessDrive = {
    midiIn: (status, data1, data2) => emu.sendInternal(status, data1, data2),
    midiExt: (status, data1, data2) => emu.sendExternal(status, data1, data2),
    advanceTicks: (ticks = 1) => {
      for (let i = 0; i < ticks; i++) {
        emu.renderBlocks(BLOCKS_PER_TICK);
        emu.tick();
      }
    },
  };
  const inspection: OvtHarnessInspection = {
    dsp,
    leds,
    buttonLeds,
    schwung,
  };
  return {
    ...drive,
    ...inspection,
    drive,
    inspection,
  };
}

export function createGlobalOvtHarnessPort(target: typeof globalThis = globalThis): EmulatorHarnessPort {
  return createGlobalBrowserObservability(target);
}
