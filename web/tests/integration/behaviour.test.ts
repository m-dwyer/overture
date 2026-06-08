import { describe, test, expect, beforeAll } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// Behavioural spec derived from tool/MANUAL.md §15 Cheat Sheet — the davebox manual,
// NOT the Move manual. Each test pins a documented behaviour by asserting ENGINE
// TRUTH (get_param) or emitted MIDI, never how the OLED is drawn. These exist so
// that when Overture changes a behaviour (docs/DAVEBOX-CHANGES.md), we update the
// expectation first (TDD): edit test -> it fails on the old behaviour -> implement.
//
// Topology (probed): track index 0 defaults to a DRUM track, index 1 to MELODIC.
// One shared harness per describe (re-importing ui.js isn't isolated); tests either
// read-only or return to a known state.

describe("davebox §15 — transport & global", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  }, 60_000);

  test("boots with track 1 active and transport stopped", () => {
    expect(h.get("active_track")).toBe("0");
    expect(h.get("playing")).toBe("0");
  });

  test("Play toggles the transport (playing 0<->1)", () => {
    expect(h.get("playing")).toBe("0");
    h.press(85); // Play
    h.step(5);
    expect(h.get("playing")).toBe("1");
    h.press(85); // Play again -> stop
    h.step(5);
    expect(h.get("playing")).toBe("0");
  });

  test("Shift + Step 6 cycles the metronome mode", () => {
    const before = h.get("metro_on");
    h.hold(49); // Shift
    h.tapStep(5); // Step 6 (0-based 5) = Metro
    h.release(49);
    h.step(3);
    expect(h.get("metro_on"), "metro mode should change").not.toBe(before);
  });
});

describe("davebox §15 — track topology", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  }, 60_000);

  test("track 1 defaults to drum, track 2 to melodic", () => {
    expect(h.get("t0_pad_mode")).toBe("1"); // PAD_MODE_DRUM
    expect(h.get("t1_pad_mode")).toBe("0"); // PAD_MODE_MELODIC_SCALE
  });
});

// ── Blocked on gesture-pinning (next increment) ──────────────────────────────
// These function-preservation behaviours (the ones Change #1 touches) did NOT
// reproduce from naive gestures in probing — they need the exact mechanics read
// out of the handlers (decodeDelta encoding, view/pad-mode gating, deferred DSP
// push), not the manual's one-line summaries:
//   - Shift + jog rotate -> switch active track   (ui.js:7260; active_track unchanged on poke)
//   - Side buttons CC40-43 -> switch clip          (_onCC_side; effect not yet observed)
//   - Step tap -> toggle step                      (needs a melodic track active)
//   - Mute -> toggle mute_state                    (single press did not change mute_state)
// Pinning these (read the handlers + harness round-trip) is the next slice and
// unlocks the bulk of the Track-View cheat sheet.
