import { describe, test, expect, beforeAll } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// Behavioural spec derived from tool/MANUAL.md §15 Cheat Sheet — the Overture manual,
// NOT the Move manual. Each test pins a documented behaviour by asserting ENGINE
// TRUTH (get_param) or emitted MIDI, never how the OLED is drawn. These exist so
// that when Overture changes a behaviour (docs/DAVEBOX-CHANGES.md), we update the
// expectation first (TDD): edit test -> it fails on the old behaviour -> implement.
//
// Topology (probed): track index 0 defaults to a DRUM track, index 1 to MELODIC.
// One shared harness per describe (re-importing ui.js isn't isolated); tests either
// read-only or return to a known state.

describe("Overture §15 — transport & global", () => {
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

describe("Overture §15 — track topology", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  }, 60_000);

  test("track 1 defaults to drum, track 2 to melodic", () => {
    expect(h.get("t0_pad_mode")).toBe("1"); // PAD_MODE_DRUM
    expect(h.get("t1_pad_mode")).toBe("0"); // PAD_MODE_MELODIC_SCALE
  });
});

// Track-View navigation — the function-preservation behaviours Change #1 will
// repurpose (DAVEBOX-CHANGES.md). These assert UI-mode state via the Overture test
// hook (h.ui() = S), which has no DSP get_param read-back. Boot is Session view, so
// these enter Note/Track view first. NOTE: requires the tool fork's UI-state hook
// (globalThis.overtureUiState).
describe("Overture §15 — Track View navigation (Change #1 targets)", () => {
  let h: Harness;
  beforeAll(async () => {
    h = await createHarness();
  }, 60_000);

  const noteView = () => {
    if (h.ui().sessionView) {
      h.press(50);
      h.step(2);
    }
  };

  test("Menu toggles Session <-> Note view", () => {
    const v0 = h.ui().sessionView;
    h.press(50);
    h.step(2);
    expect(h.ui().sessionView).toBe(!v0);
    h.press(50);
    h.step(2);
    expect(h.ui().sessionView).toBe(v0);
  });

  test("Shift + jog rotate switches the active track", () => {
    noteView();
    const start = h.ui().activeTrack;
    h.hold(49);
    h.cc(14, 1); // cw -> +1
    h.step(2);
    h.release(49);
    h.step(1);
    expect(h.ui().activeTrack).toBe(Math.min(7, start + 1));
    h.hold(49);
    h.cc(14, 127); // ccw -> -1 (restore)
    h.step(2);
    h.release(49);
    h.step(1);
    expect(h.ui().activeTrack).toBe(start);
  });

  test("Jog rotate cycles the active bank", () => {
    noteView();
    const b0 = h.ui().activeBank;
    h.cc(14, 1);
    h.step(2);
    expect(h.ui().activeBank).not.toBe(b0);
    h.cc(14, 127);
    h.step(2);
    expect(h.ui().activeBank).toBe(b0);
  });

  // Change #1: side buttons now SELECT TRACKS (was: switch clips). Reversed,
  // same as Shift+bottom-pad: CC43=track 1 … CC40=track 4.
  test("Side buttons select tracks 1–4 (reversed: CC43=track 0 … CC40=track 3)", () => {
    noteView();
    h.press(43);
    h.step(2);
    expect(h.ui().activeTrack).toBe(0);
    h.press(42);
    h.step(2);
    expect(h.ui().activeTrack).toBe(1);
    h.press(41);
    h.step(2);
    expect(h.ui().activeTrack).toBe(2);
    h.press(40);
    h.step(2);
    expect(h.ui().activeTrack).toBe(3);
    h.press(43);
    h.step(2); // restore track 0
  });

  // Change #1: holding a side button reveals that track's 16 clips on the
  // steps; tapping a step selects (launches) that clip on the held track.
  // This is the relocation home for the old side-button clip-switch.
  test("Hold side button + tap step selects that track's clip", () => {
    noteView();
    // Select track 1 (CC43) and keep holding past the hold threshold.
    h.hold(43);
    h.step(25); // cross STEP_HOLD_TICKS (~19) -> reveal overlay engages
    expect(h.ui().revealClipsTrack).toBe(0);
    h.tapStep(2); // step 3 -> clip index 2 on track 0
    h.step(2);
    expect((h.ui().trackActiveClip as number[])[0]).toBe(2);
    h.release(43);
    h.step(2);
    expect(h.ui().revealClipsTrack).toBe(-1); // overlay exits on release
    // restore clip 0
    h.hold(43);
    h.step(25);
    h.tapStep(0);
    h.step(2);
    h.release(43);
    h.step(2);
  });

  // Change #1: Shift+side banks to tracks 5–8 (CC43=track 5 … CC40=track 8).
  test("Shift + side button selects tracks 5–8 (bank)", () => {
    noteView();
    h.hold(49);
    h.press(43); // Shift+CC43 -> track 5 (index 4)
    h.release(49);
    h.step(2);
    expect(h.ui().activeTrack).toBe(4);
    h.hold(49);
    h.press(40); // Shift+CC40 -> track 8 (index 7)
    h.release(49);
    h.step(2);
    expect(h.ui().activeTrack).toBe(7);
    h.press(43);
    h.step(2); // plain CC43 -> back to track 0
    expect(h.ui().activeTrack).toBe(0);
  });

  test("Shift + bottom-row pad switches the active track", () => {
    noteView();
    h.hold(49);
    h.pad(2); // bottom pad 3 -> track index 2
    h.release(49);
    h.step(2);
    expect(h.ui().activeTrack).toBe(2);
    h.hold(49);
    h.pad(0); // back to track 1
    h.release(49);
    h.step(2);
    expect(h.ui().activeTrack).toBe(0);
  });
});
