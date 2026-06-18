import { describe, test, expect, beforeEach } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// Drum-lane workflows — Overture's drum Track-View lane gestures (mute/solo,
// clear, factory-reset, copy/cut-paste) driven through the REAL ui.js +
// seq8-wasm and asserted against ENGINE TRUTH (get_param readback). These prove
// the lane set_params (tN_lL_mute/_solo/_clear/_hard_reset/_copy_to/_cut_to)
// actually reach the DSP and mutate the active clip's lane — the "is it real on
// the engine?" question the unit tier (mock deps) can't answer.
// Targets drum/ui_drum_lane_workflows.mjs (11% behaviour at the Step-1 baseline).
//
// Topology (probed): track 0 = DRUM. Pads are NOTE 68+idx; with lane page 0,
// drumPadToLane(idx) = floor(idx/8)*4 + (idx%8) for col 0..3 (col 4..7 = vel
// zones), so lane L lives on pad floor(L/4)*8 + (L%4).

const padForLane = (lane: number): number => Math.floor(lane / 4) * 8 + (lane % 4);

/** Enter drum Track View on track 0 with a known lane/bank/page. */
function drumTrackView(h: Harness, lane = 0): void {
  if (h.ui().sessionView) {
    h.press(50); // Menu → Note/Track view
    h.step(2);
  }
  const s = h.ui();
  s.activeTrack = 0;
  s.activeBank = 0;
  s.activeDrumLane[0] = lane;
  s.drumStepPage[0] = 0;
  // copySrc lives on the ui.js module singleton and is NOT cleared by init(),
  // so a prior test's copy/cut arming leaks across harnesses (see behaviour.test.ts).
  s.copySrc = null;
  h.step(1);
}

/** Tap step buttons to lay real hits on the active drum lane (engine-backed). */
function layHits(h: Harness, steps: number[]): void {
  for (const i of steps) {
    h.tapStep(i);
    h.step(1);
  }
}

/** Press a grid pad with the given UI modifier flags held (mute/copy/delete/
 * shift), as a button-held + pad gesture; flags are set on S directly (the
 * idiom used across behaviour.test.ts) and cleared after the release. */
function padWithMods(h: Harness, padIdx: number, mods: string[], settle = 2): void {
  const s = h.ui();
  for (const m of mods) (s as Record<string, unknown>)[m] = true;
  h.emu.sendInternal(0x90, 68 + padIdx, 110);
  h.step(1);
  h.emu.sendInternal(0x80, 68 + padIdx, 0);
  h.step(1);
  for (const m of mods) (s as Record<string, unknown>)[m] = false;
  h.step(settle);
}

const muteBits = (h: Harness, t = 0): number => Number(h.get(`t${t}_drum_lane_mute`));
const soloBits = (h: Harness, t = 0): number => Number(h.get(`t${t}_drum_lane_solo`));
const noteCount = (h: Harness, t: number, l: number): number => Number(h.get(`t${t}_l${l}_note_count`));
const laneSteps = (h: Harness, t: number, l: number): string => h.get(`t${t}_l${l}_steps`) as string;
const hasHit = (steps: string): boolean => /[12]/.test(steps);

describe("Drum lane mute / solo (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
    drumTrackView(h);
  }, 60_000);

  test("Mute + lane pad toggles that lane's mute bit in the engine", () => {
    expect(muteBits(h) & (1 << 2)).toBe(0);

    padWithMods(h, padForLane(2), ["muteHeld"]);
    expect(muteBits(h) & (1 << 2)).not.toBe(0); // lane 2 muted

    padWithMods(h, padForLane(2), ["muteHeld"]);
    expect(muteBits(h) & (1 << 2)).toBe(0); // toggled back off
  });

  test("Shift+Mute + lane pad solos the lane and clears its mute bit", () => {
    // First mute lane 1.
    padWithMods(h, padForLane(1), ["muteHeld"]);
    expect(muteBits(h) & (1 << 1)).not.toBe(0);
    expect(soloBits(h) & (1 << 1)).toBe(0);

    // Solo lane 1 → solo bit set, mute bit cleared (mutually exclusive).
    padWithMods(h, padForLane(1), ["muteHeld", "shiftHeld"]);
    expect(soloBits(h) & (1 << 1)).not.toBe(0);
    expect(muteBits(h) & (1 << 1)).toBe(0);
  });
});

describe("Drum lane clear / factory reset (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
    drumTrackView(h, 0);
  }, 60_000);

  test("Delete + lane pad clears the lane's notes in the engine", () => {
    layHits(h, [0, 4, 8, 12]);
    expect(noteCount(h, 0, 0)).toBeGreaterThan(0);
    expect(hasHit(laneSteps(h, 0, 0))).toBe(true);

    padWithMods(h, padForLane(0), ["deleteHeld"]);

    expect(noteCount(h, 0, 0)).toBe(0);
    expect(hasHit(laneSteps(h, 0, 0))).toBe(false);
  });

  test("Shift+Delete + lane pad factory-resets the lane (notes + length + loop)", () => {
    layHits(h, [2, 6, 10]);
    // Shrink the loop window so the reset is observable (loop_start 8, length 32).
    h.set("t0_l0_loop_set", (8 << 16) | 32);
    h.step(3);
    expect(Number(h.get("t0_l0_length"))).toBe(32);
    expect(Number(h.get("t0_l0_loop_start"))).toBe(8);

    padWithMods(h, padForLane(0), ["shiftHeld", "deleteHeld"]);

    expect(noteCount(h, 0, 0)).toBe(0);
    expect(Number(h.get("t0_l0_length"))).toBe(16); // back to default
    expect(Number(h.get("t0_l0_loop_start"))).toBe(0);
  });
});

describe("Drum lane copy / cut-paste (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
    drumTrackView(h, 0);
  }, 60_000);

  test("Copy lane 0 + paste onto lane 3 duplicates the pattern in the engine", () => {
    layHits(h, [0, 3, 7, 11]);
    const srcCount = noteCount(h, 0, 0);
    const srcSteps = laneSteps(h, 0, 0);
    expect(srcCount).toBeGreaterThan(0);
    expect(noteCount(h, 0, 3)).toBe(0); // dst empty before

    // Copy gesture: hold Copy, tap source lane (arms copySrc), tap dest lane.
    const s = h.ui();
    s.copyHeld = true;
    h.emu.sendInternal(0x90, 68 + padForLane(0), 110); h.step(1);
    h.emu.sendInternal(0x80, 68 + padForLane(0), 0); h.step(1);
    h.emu.sendInternal(0x90, 68 + padForLane(3), 110); h.step(1);
    h.emu.sendInternal(0x80, 68 + padForLane(3), 0); h.step(1);
    s.copyHeld = false;
    h.step(10); // drain the deferred copy_to set_param

    expect(noteCount(h, 0, 3)).toBe(srcCount);
    expect(laneSteps(h, 0, 3)).toBe(srcSteps);
    // Source is untouched by a copy.
    expect(noteCount(h, 0, 0)).toBe(srcCount);
  });

  test("Cut lane 0 (Shift+Copy) + paste onto lane 5 moves the pattern", () => {
    layHits(h, [1, 5, 9]);
    const srcCount = noteCount(h, 0, 0);
    const srcSteps = laneSteps(h, 0, 0);
    expect(srcCount).toBeGreaterThan(0);

    const s = h.ui();
    s.copyHeld = true;
    s.shiftHeld = true; // Shift on the source press marks it a CUT
    h.emu.sendInternal(0x90, 68 + padForLane(0), 110); h.step(1);
    h.emu.sendInternal(0x80, 68 + padForLane(0), 0); h.step(1);
    s.shiftHeld = false;
    h.emu.sendInternal(0x90, 68 + padForLane(5), 110); h.step(1);
    h.emu.sendInternal(0x80, 68 + padForLane(5), 0); h.step(1);
    s.copyHeld = false;
    h.step(10);

    // Destination got the pattern…
    expect(noteCount(h, 0, 5)).toBe(srcCount);
    expect(laneSteps(h, 0, 5)).toBe(srcSteps);
    // …and the source was emptied by the cut.
    expect(noteCount(h, 0, 0)).toBe(0);
    expect(hasHit(laneSteps(h, 0, 0))).toBe(false);
  });
});
