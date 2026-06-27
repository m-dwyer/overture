// The emulator's runtime binding: DSP selection, the ~94 Hz device tick loop, and
// the globalThis.OVT console/test handle. Pulled out of App.tsx so the loop and its
// test surface live together, away from the React view. App orchestrates the async
// boot (it owns the refs + lifecycle) and calls these.
import { createMockDsp } from "../mock-dsp";
import type { Dsp } from "../dsp";
import type { Emulator } from "./emulator";
import type { BrowserSchwungHost } from "@/schwung/browser-chain";

const TICK_HZ = 94;
const BLOCK_MS = (1000 * 128) / 44100; // one audio block of real time (~2.9 ms)
// Audio blocks the loop renders per tick at TICK_HZ (~4). Used by OVT.advanceTicks
// so a synchronously-driven tick matches a wall-clock one.
const BLOCKS_PER_TICK = Math.round(1000 / TICK_HZ / BLOCK_MS);

/** Current Overture emulator DSP surface. The active tool has no DSP/WASM build
 * yet, so the emulator uses the JS mock. */
export async function pickDsp(log: (msg: string) => void, schwung?: BrowserSchwungHost): Promise<Dsp> {
  void schwung;
  log("dsp: mock");
  return createMockDsp();
}

/** Start the device loop: each iteration renders the audio blocks for the real
 *  elapsed time (clamped to avoid a post-stall flood), then ticks the tool. Returns
 *  a stop fn. */
export function startTickLoop(emu: Emulator, log: (msg: string) => void): () => void {
  let ticks = 0;
  let lastRenderT = performance.now();
  const id = setInterval(() => {
    const now = performance.now();
    let blocks = Math.floor((now - lastRenderT) / BLOCK_MS);
    if (blocks > 16) {
      blocks = 16;
      lastRenderT = now;
    } else {
      lastRenderT += blocks * BLOCK_MS;
    }
    emu.renderBlocks(blocks);
    try {
      emu.tick();
    } catch (e) {
      if (ticks % 94 === 0) log("tick() threw: " + ((e as Error)?.message || e));
    }
    ticks++;
  }, 1000 / TICK_HZ);
  return () => clearInterval(id);
}

/** Install the console/test handle. midiIn/midiExt run synchronously into the tool;
 *  advanceTicks flushes the dirty-gated redraw in-stack (mirrors the loop body) so
 *  screenshot tests never race the wall-clock loop. See web/tests/wait.ts. */
export function installOvt(
  emu: Emulator,
  dsp: Dsp,
  leds: Map<number, number>,
  buttonLeds: Map<number, number>,
  schwung?: BrowserSchwungHost,
): void {
  globalThis.OVT = {
    dsp,
    leds,
    buttonLeds,
    schwung,
    midiIn: (s: number, d1: number, d2: number) => emu.sendInternal(s, d1, d2),
    midiExt: (s: number, d1: number, d2: number) => emu.sendExternal(s, d1, d2),
    advanceTicks: (n = 1) => {
      for (let i = 0; i < n; i++) {
        emu.renderBlocks(BLOCKS_PER_TICK);
        emu.tick();
      }
    },
  };
}
