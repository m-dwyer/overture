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

describe("Overture Phase 4 — clips left off stay off", () => {
  test("focused clip with notes does not auto-launch just because Play starts", async () => {
    const h = await createHarness();
    if (h.ui().sessionView) {
      h.press(50);
      h.step(2);
    }

    h.tapStep(0);
    h.step(3);
    expect(h.ui().drumClipNonEmpty[0][0]).toBe(true);
    expect(h.ui().trackClipPlaying[0]).toBe(false);

    h.press(85);
    h.step(8);

    expect(h.get("playing")).toBe("1");
    expect(h.ui().trackClipPlaying[0]).toBe(false);
    expect(h.ui().trackQueuedClip[0]).toBe(-1);
  }, 60_000);
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

  test("releasing a different side button does not clear hold-reveal state", () => {
    noteView();
    h.hold(43);
    h.step(25);

    expect(h.ui().sideHeldBtn).toBe(3);
    expect(h.ui().sideBtnPressedTick).not.toBe(-1);
    expect(h.ui().revealClipsTrack).toBe(0);

    h.release(42);
    h.step(2);

    expect(h.ui().sideHeldBtn).toBe(3);
    expect(h.ui().sideBtnPressedTick).not.toBe(-1);
    expect(h.ui().revealClipsTrack).toBe(0);

    h.release(43);
    h.step(2);
    expect(h.ui().sideHeldBtn).toBe(-1);
    expect(h.ui().sideBtnPressedTick).toBe(-1);
    expect(h.ui().revealClipsTrack).toBe(-1);
  });

  test("Track View side press arms hold-reveal tracking", () => {
    noteView();
    const tickBefore = h.ui().tickCount as number;

    h.hold(42);
    h.step(2);

    expect(h.ui().activeTrack).toBe(1);
    expect(h.ui().sideHeldBtn).toBe(2);
    expect(h.ui().sideBtnPressedTick as number).toBeGreaterThanOrEqual(tickBefore);
    expect(h.ui().revealClipsTrack).toBe(-1);

    h.release(42);
    h.step(2);
    expect(h.ui().sideHeldBtn).toBe(-1);
    expect(h.ui().sideBtnPressedTick).toBe(-1);
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

  test("Delete + side button in Track View is swallowed and does not select a track", () => {
    noteView();
    h.press(43);
    h.step(2);
    expect(h.ui().activeTrack).toBe(0);

    h.ui().deleteHeld = true;
    h.cc(40, 127);
    h.step(2);
    h.ui().deleteHeld = false;

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

  // Change #3: while a step is held the jog wheel is reserved for step length —
  // it must NOT silently cycle banks. Previously _onCC_jog ignored heldStep and
  // changed S.activeBank underneath the step-edit overlay (visible only on release).
  test("holding a step, the jog wheel does not cycle banks", () => {
    noteView();
    const bank0 = h.ui().activeBank;
    h.emu.sendInternal(0x90, 16, 127); // press step 1 (note 16)
    h.step(25); // hold past STEP_HOLD_TICKS -> Step Edit
    h.cc(14, 1); // jog cw
    h.step(2);
    h.cc(14, 1); // jog cw again
    h.step(2);
    const bankHeld = h.ui().activeBank;
    h.emu.sendInternal(0x80, 16, 0); // release step 1
    h.step(2);
    expect(bankHeld).toBe(bank0);
  });

  // Change #3: holding a step WITH content, the jog adjusts that step's length
  // (gate). Track 0 is drum; tap step 2 to lay a hit, then hold + jog.
  test("holding a step with content, the jog changes that step's length", () => {
    noteView();
    h.tapStep(1); // toggle a hit on step 2 (drum lane 0)
    h.step(2);
    const gateBefore = h.get("t0_l0_step_1_gate");
    h.emu.sendInternal(0x90, 17, 127); // hold step 2 (note 17)
    h.step(25); // -> Step Edit
    h.cc(14, 1); // jog cw -> longer
    h.step(2);
    const gateAfter = h.get("t0_l0_step_1_gate");
    h.emu.sendInternal(0x80, 17, 0); // release
    h.step(2);
    expect(gateAfter).not.toBe(gateBefore);
  });

  test("Loop + single step sets the active drum lane length fallback", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;

    h.hold(58); // Loop
    h.emu.sendInternal(0x90, 19, 127); // step 4
    h.step(2);

    expect(h.ui().loopGestureStart).toBe(3);
    expect(h.ui().drumLaneLength[0]).not.toBe(64);

    h.emu.sendInternal(0x80, 19, 0);

    expect(h.ui().loopGestureStart).toBe(-1);
    expect(h.ui().drumLaneLoopStart[0]).toBe(0);
    expect(h.ui().drumLaneLength[0]).toBe(64);

    h.step(2);
    expect(h.get("t0_l0_loop_start")).toBe("0");
    expect(h.get("t0_l0_length")).toBe("64");
    h.release(58);
    h.step(2);
  });

  test("Loop + two steps sets a reversed drum lane range", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;

    h.hold(58); // Loop
    h.emu.sendInternal(0x90, 23, 127); // step 8: arm
    h.step(2);
    h.emu.sendInternal(0x90, 18, 127); // step 3: B before A

    expect(h.ui().loopGestureFired).toBe(true);
    expect(h.ui().drumLaneLoopStart[0]).toBe(32);
    expect(h.ui().drumLaneLength[0]).toBe(96);

    h.step(2);
    expect(h.get("t0_l0_loop_start")).toBe("32");
    expect(h.get("t0_l0_length")).toBe("96");

    h.emu.sendInternal(0x80, 23, 0);
    h.emu.sendInternal(0x80, 18, 0);
    h.step(2);
    h.release(58);
    h.step(2);
  });

  test("Loop + step is blocked during active recording", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;
    h.ui().recordArmed = true;
    h.ui().recordCountingIn = false;
    const lenBefore = h.ui().drumLaneLength[0];
    const paramBefore = h.get("t0_l0_length");

    h.hold(58); // Loop
    h.emu.sendInternal(0x90, 20, 127);
    h.step(2);
    h.emu.sendInternal(0x80, 20, 0);
    h.step(2);
    h.release(58);
    h.step(2);

    expect(h.ui().loopGestureStart).toBe(-1);
    expect(h.ui().drumLaneLength[0]).toBe(lenBefore);
    expect(h.get("t0_l0_length")).toBe(paramBefore);

    h.ui().recordArmed = false;
  });
});
