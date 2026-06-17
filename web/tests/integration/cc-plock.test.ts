import { describe, test, expect, beforeEach } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// AUTO/CC p-locks — Overture's novel path: the CC PARAM bank (bank 6, melodic)
// maps the 8 knobs to Move-engine params (cable-0 encoder-CC) and records/edits
// per-clip values. These tests drive the real knob gestures through ui.js →
// seq8-wasm and assert ENGINE TRUTH (get_param readback), proving the
// set_params (cc_rest / cc_type_assign / cc_auto_clear_k) actually reach the DSP.
// Targets input/ui_knob_cc_workflow.mjs handleUiKnobCcParam (7% behavior at Step 1).

const KNOB0 = 71;   // first CC-lane knob (CCs 71..78)
const DELETE = 119; // MoveDelete

/** Enter the CC PARAM bank (6) on a melodic track. The knob handler reads
 * S.activeBank/activeTrack directly; track 1 is melodic by default. */
function enterCcBank(h: Harness, track = 1): number {
  const s = h.ui();
  s.activeTrack = track;
  s.activeBank = 6;
  s.trackActiveBank[track] = 6;
  return s.trackActiveClip[track] ?? 0;
}

/** Turn a knob CW n detents (each as a discrete CC). */
function turnUp(h: Harness, cc: number, n: number): void {
  for (let i = 0; i < n; i++) h.cc(cc, 1);
  h.step(1);
}

const ccRest = (h: Harness, t: number, c: number): number[] =>
  (h.get(`t${t}_c${c}_cc_rest`) as string).split(" ").map(Number);

describe("AUTO/CC p-locks — knob path (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
  }, 60_000);

  test("turning a CC knob (stopped) sets the clip resting value in the engine", () => {
    const ac = enterCcBank(h, 1);
    expect(ccRest(h, 1, ac)[0]).toBe(255); // 255 = "—" (unset)

    turnUp(h, KNOB0, 18);

    const jsVal = h.ui().clipCCVal[1][ac][0] as number;
    expect(jsVal).toBeGreaterThanOrEqual(0);
    // Engine truth matches the JS-side value → cc_rest reached the DSP.
    expect(ccRest(h, 1, ac)[0]).toBe(jsVal);
  });

  test("Delete+turn clears the lane's resting value back to “—”", () => {
    const ac = enterCcBank(h, 1);
    turnUp(h, KNOB0, 18);
    expect(h.ui().clipCCVal[1][ac][0]).toBeGreaterThanOrEqual(0);

    h.hold(DELETE);
    h.cc(KNOB0, 1);
    h.step(1);
    h.release(DELETE);

    expect(h.ui().clipCCVal[1][ac][0]).toBe(-1);
    expect(ccRest(h, 1, ac)[0]).toBe(255); // engine cleared to "—"
  });

  test("alt-mode turn re-assigns the knob's CC number in the engine", () => {
    enterCcBank(h, 1);
    // Knob 0 defaults to CC 7 (CC_ASSIGN_DEFAULTS[0]).
    expect(Number((h.get("t1_cc_assigns") as string).split(" ")[0])).toBe(7);
    expect(Number((h.get("t1_cc_types") as string).split(" ")[0])).toBe(0);

    const s = h.ui();
    s.altMode = true;
    // The ladder advances one CC per 4 accumulated detents; 8 → +2 (CC 7 → 9).
    turnUp(h, KNOB0, 8);
    s.altMode = false;

    expect(h.ui().trackCCType[1][0]).toBe(0); // still a plain CC
    expect(Number((h.get("t1_cc_assigns") as string).split(" ")[0])).toBe(9);
    expect(Number((h.get("t1_cc_types") as string).split(" ")[0])).toBe(0);
  });
});
