import { describe, test, expect, beforeEach } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// Tick-pipeline drain semantics — the load-bearing ordering/timing invariants of
// runTickWorkflow (ui/tick/ui_tick_workflow.mjs + ui_tick_tasks.mjs). These pin
// the deferred-queue behaviour that input handlers rely on: set_params can't go
// out from onMidiMessage (the host coalesces — only the last per buffer reaches
// DSP), so handlers QUEUE them and tick() drains them one-per-tick, in order,
// behind gates. Asserted via engine truth (get_param). Targets ui_tick_tasks.mjs
// (59% behaviour) — the riskiest *headless-able* seam.

const muteBits = (h: Harness, t = 0): number => Number(h.get(`t${t}_drum_lane_mute`));

/** Settle the drain gates and seed the queue with exactly these entries. */
function seedQueue(h: Harness, entries: Array<{ key: string; val: string }>): void {
  const s = h.ui();
  s.pendingSetLoad = false;
  s.pendingDspSync = 0;
  s.clearDrainHold = 0;
  s.pendingDefaultSetParams = entries.slice();
}

describe("Tick pipeline — pendingDefaultSetParams drain (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
    h.ui().activeTrack = 0; // drum track
    h.step(1);
  }, 60_000);

  test("drains exactly one set_param per tick, in FIFO order (coalescing-avoidance)", () => {
    expect(muteBits(h)).toBe(0);
    // Three distinct per-track keys → mute lanes 0,1,2 via the deferred queue.
    seedQueue(h, [
      { key: "t0_l0_mute", val: "1" },
      { key: "t0_l1_mute", val: "1" },
      { key: "t0_l2_mute", val: "1" },
    ]);

    h.step(1);
    // Exactly lane 0 so far — one per tick.
    expect(muteBits(h) & 0b111).toBe(0b001);
    expect(h.ui().pendingDefaultSetParams.length).toBe(2);

    h.step(1);
    expect(muteBits(h) & 0b111).toBe(0b011); // lanes 0,1
    expect(h.ui().pendingDefaultSetParams.length).toBe(1);

    h.step(1);
    expect(muteBits(h) & 0b111).toBe(0b111); // lanes 0,1,2
    expect(h.ui().pendingDefaultSetParams.length).toBe(0);
  });

  test("clearDrainHold defers the drain by exactly that many ticks", () => {
    expect(muteBits(h)).toBe(0);
    seedQueue(h, [{ key: "t0_l0_mute", val: "1" }]);
    h.ui().clearDrainHold = 2; // hold the drain for 2 ticks

    h.step(1);
    expect(muteBits(h) & 0b1).toBe(0); // held (hold 2 → 1)
    h.step(1);
    expect(muteBits(h) & 0b1).toBe(0); // held (hold 1 → 0)
    h.step(1);
    expect(muteBits(h) & 0b1).toBe(0b1); // hold elapsed → drains
  });
});
