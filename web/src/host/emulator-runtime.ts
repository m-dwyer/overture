// The emulator's runtime binding: DSP selection, the ~94 Hz device tick loop, and
// the globalThis.OVT console/test handle. Pulled out of App.tsx so the loop and its
// test surface live together, away from the React view. App orchestrates the async
// boot (it owns the refs + lifecycle) and calls these.
import { createMockDsp } from "../mock-dsp";
import { createWasmDsp } from "../wasm-dsp";
import type { Dsp } from "../dsp";
import type { Emulator } from "./emulator";

const TICK_HZ = 94;
const BLOCK_MS = (1000 * 128) / 44100; // one audio block of real time (~2.9 ms)
// Audio blocks the loop renders per tick at TICK_HZ (~4). Used by OVT.advanceTicks
// so a synchronously-driven tick matches a wall-clock one.
const BLOCKS_PER_TICK = Math.round(1000 / TICK_HZ / BLOCK_MS);

/** Behavior tier: the real seq8-wasm engine, or the JS mock when `?mock` is set or
 *  wasm fails to load. */
export async function pickDsp(log: (msg: string) => void): Promise<Dsp> {
  if (new URLSearchParams(location.search).has("mock")) return createMockDsp();
  try {
    const dsp = await createWasmDsp((tag, b0, b1, b2, b3) => log(`dsp→midi [${tag}] ${b0} ${b1} ${b2} ${b3}`));
    log("dsp: seq8-wasm (behavior tier)");
    return dsp;
  } catch (e) {
    log("seq8-wasm load failed — using mock: " + ((e as Error)?.message || e));
    return createMockDsp();
  }
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
  buttonLeds: Map<number, number>
): void {
  globalThis.OVT = {
    dsp,
    leds,
    buttonLeds,
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
