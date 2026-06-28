// The emulator's runtime binding: DSP selection and the ~94 Hz device tick loop.
// App orchestrates the async boot (it owns the refs + lifecycle) and calls these.
import { createMockDsp } from "../mock-dsp";
import type { Dsp } from "../dsp";
import type { Emulator } from "./emulator";
import type { BrowserSchwungHost } from "@/schwung/browser-chain";

const TICK_HZ = 94;
const BLOCK_MS = (1000 * 128) / 44100; // one audio block of real time (~2.9 ms)

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
