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

  test("Side buttons switch clips (reversed: CC43=clip 0 … CC40=clip 3)", () => {
    noteView();
    const t = h.ui().activeTrack;
    const clip = () => (h.ui().trackActiveClip as number[])[t];
    h.press(43);
    h.step(2);
    expect(clip()).toBe(0);
    h.press(42);
    h.step(2);
    expect(clip()).toBe(1);
    h.press(41);
    h.step(2);
    expect(clip()).toBe(2);
    h.press(40);
    h.step(2);
    expect(clip()).toBe(3);
    h.press(43);
    h.step(2); // restore clip 0
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
