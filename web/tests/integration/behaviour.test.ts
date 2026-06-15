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

  test("Loop + two steps sets the active melodic clip range", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 0;
    h.ui().trackCurrentPage[1] = 0;

    const ac = h.ui().trackActiveClip[1] as number;
    h.ui().clipLengthManuallySet[1][ac] = false;

    h.hold(58); // Loop
    h.emu.sendInternal(0x90, 17, 127); // step 2: arm
    h.step(2);
    h.emu.sendInternal(0x90, 20, 127); // step 5: B

    expect(h.ui().loopGestureFired).toBe(true);
    expect(h.ui().clipLoopStart[1][ac]).toBe(16);
    expect(h.ui().clipLength[1][ac]).toBe(64);
    expect(h.ui().clipLengthManuallySet[1][ac]).toBe(true);
    expect(h.ui().trackCurrentPage[1]).toBe(1);

    h.step(2);
    expect(h.get("t1_c0_loop_start")).toBe("16");
    expect(h.get("t1_c0_length")).toBe("64");

    h.emu.sendInternal(0x80, 17, 0);
    h.emu.sendInternal(0x80, 20, 0);
    h.step(2);
    h.release(58);
    h.step(2);
  });

  test("Loop + step keeps priority over Copy + step in Track View", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 0;
    h.ui().trackCurrentPage[1] = 0;

    const ac = h.ui().trackActiveClip[1] as number;
    h.ui().clipLoopStart[1][ac] = 0;
    h.ui().clipLength[1][ac] = 64;
    h.ui().clipLengthManuallySet[1][ac] = false;
    h.ui().copySrc = null;

    h.hold(60); // Copy
    h.hold(58); // Loop
    h.emu.sendInternal(0x90, 17, 127); // step 2: Loop arm, not Copy source
    h.step(2);
    h.emu.sendInternal(0x90, 20, 127); // step 5: Loop B

    expect(h.ui().loopGestureFired).toBe(true);
    expect(h.ui().copySrc).toBe(null);
    expect(h.ui().clipLoopStart[1][ac]).toBe(16);
    expect(h.ui().clipLength[1][ac]).toBe(64);

    h.emu.sendInternal(0x80, 17, 0);
    h.emu.sendInternal(0x80, 20, 0);
    h.step(2);
    h.release(58);
    h.release(60);
    h.step(2);
  });

  test("Loop + step keeps priority over Delete + step in Track View", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;
    h.ui().drumStepPage[0] = 0;
    h.ui().drumLaneSteps[0][0][1] = "1";
    h.ui().drumLaneHasNotes[0][0] = true;
    h.ui().deleteHeld = true;

    h.hold(58); // Loop
    h.emu.sendInternal(0x90, 17, 127); // step 2: Loop arm, not Delete clear
    h.step(2);

    expect(h.ui().loopGestureStart).toBe(1);
    expect(h.ui().drumLaneSteps[0][0][1]).toBe("1");

    h.emu.sendInternal(0x80, 17, 0);
    h.step(2);
    h.release(58);
    h.ui().deleteHeld = false;
    h.step(2);
  });

  test("Copy + step keeps priority over Delete + Mute + step in Track View", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 0;
    h.ui().trackCurrentPage[1] = 0;
    h.ui().copySrc = null;
    h.ui().pendingDefaultSetParams = [];
    h.ui().copyHeld = true;
    h.ui().deleteHeld = true;
    h.ui().muteHeld = true;

    h.emu.sendInternal(0x90, 20, 127); // step 5: Copy source, not Delete/Mute
    h.step(2);

    expect(h.ui().copySrc).toEqual({ kind: "step", absStep: 4 });
    expect(h.ui().pendingDefaultSetParams).toEqual([]);

    h.emu.sendInternal(0x80, 20, 0);
    h.ui().copyHeld = false;
    h.ui().deleteHeld = false;
    h.ui().muteHeld = false;
    h.step(2);
  });

  test("Delete + step keeps priority over Mute + step in Track View", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;
    h.ui().drumStepPage[0] = 0;
    h.ui().drumLaneSteps[0][0][4] = "1";
    h.ui().drumLaneHasNotes[0][0] = true;
    h.ui().deleteHeld = true;
    h.ui().muteHeld = true;

    h.emu.sendInternal(0x90, 20, 127); // step 5: Delete clear, not normal Mute+step edit
    h.step(2);

    expect(h.ui().drumLaneSteps[0][0][4]).toBe("0");
    expect(h.ui().heldStep).toBe(-1);

    h.emu.sendInternal(0x80, 20, 0);
    h.ui().deleteHeld = false;
    h.ui().muteHeld = false;
    h.step(2);
  });

  test("Loop + step keeps priority over Shift + step in Track View", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 0;
    h.ui().trackCurrentPage[1] = 0;
    h.ui().padLayoutChromatic[1] = false;
    h.ui().shiftHeld = true;

    h.hold(58); // Loop
    h.emu.sendInternal(0x90, 23, 127); // step 8: Loop arm, not chromatic toggle
    h.step(2);

    expect(h.ui().loopGestureStart).toBe(7);
    expect(h.ui().padLayoutChromatic[1]).toBe(false);

    h.emu.sendInternal(0x80, 23, 0);
    h.step(2);
    h.release(58);
    h.ui().shiftHeld = false;
    h.step(2);
  });

  test("Copy + step keeps priority over Shift + step in Track View", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 0;
    h.ui().trackCurrentPage[1] = 0;
    h.ui().padLayoutChromatic[1] = false;
    h.ui().copySrc = null;
    h.ui().copyHeld = true;
    h.ui().shiftHeld = true;

    h.emu.sendInternal(0x90, 23, 127); // step 8: Copy source, not chromatic toggle
    h.step(2);

    expect(h.ui().copySrc).toEqual({ kind: "step", absStep: 7 });
    expect(h.ui().padLayoutChromatic[1]).toBe(false);

    h.emu.sendInternal(0x80, 23, 0);
    h.ui().copyHeld = false;
    h.ui().shiftHeld = false;
    h.step(2);
  });

  test("Delete + step keeps priority over Shift + step in Track View", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;
    h.ui().drumStepPage[0] = 0;
    h.ui().drumLaneSteps[0][0][15] = "1";
    h.ui().drumLaneHasNotes[0][0] = true;
    h.ui().drumLaneQnt[0] = 64;
    h.ui().deleteHeld = true;
    h.ui().shiftHeld = true;

    h.emu.sendInternal(0x90, 31, 127); // step 16: Delete clear, not Shift quantize
    h.step(2);

    expect(h.ui().drumLaneSteps[0][0][15]).toBe("0");
    expect(h.ui().drumLaneQnt[0]).toBe(64);

    h.emu.sendInternal(0x80, 31, 0);
    h.ui().deleteHeld = false;
    h.ui().shiftHeld = false;
    h.step(2);
  });

  test("Mute + step on a drum track preserves normal step tap behavior", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;
    h.ui().drumStepPage[0] = 0;
    h.ui().drumLaneSteps[0][0][6] = "0";
    h.ui().drumLaneHasNotes[0][0] = false;
    h.ui().muteHeld = true;

    h.emu.sendInternal(0x90, 22, 127); // press step 7
    h.step(2);
    expect(h.ui().heldStep).toBe(6);

    h.emu.sendInternal(0x80, 22, 0);
    h.step(2);

    expect(h.ui().drumLaneSteps[0][0][6]).toBe("1");
    expect(h.ui().drumLaneHasNotes[0][0]).toBe(true);
    expect(h.ui().heldStep).toBe(-1);

    h.ui().muteHeld = false;
    h.step(2);
  });

  test("plain drum step tap toggles an empty step", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;
    h.ui().drumStepPage[0] = 0;
    h.ui().drumLaneSteps[0][0][9] = "0";
    h.ui().drumLaneHasNotes[0][0] = false;

    h.tapStep(9);
    h.step(2);

    expect(h.ui().drumLaneSteps[0][0][9]).toBe("1");
    expect(h.ui().drumLaneHasNotes[0][0]).toBe(true);
    expect(h.ui().heldStep).toBe(-1);
  });

  test("plain drum step hold auto-assigns empty step without tap-clearing on release", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;
    h.ui().drumStepPage[0] = 0;
    h.ui().drumLaneSteps[0][0][10] = "0";
    h.ui().drumLaneHasNotes[0][0] = false;

    h.emu.sendInternal(0x90, 26, 127); // hold step 11
    h.step(25);

    expect(h.ui().heldStep).toBe(10);
    expect(h.ui().stepWasHeld).toBe(true);
    expect(h.ui().drumLaneSteps[0][0][10]).toBe("1");

    h.emu.sendInternal(0x80, 26, 0);
    h.step(2);

    expect(h.ui().drumLaneSteps[0][0][10]).toBe("1");
    expect(h.ui().drumLaneHasNotes[0][0]).toBe(true);
    expect(h.ui().heldStep).toBe(-1);
  });

  test("Mute + step on a melodic track preserves normal step tap behavior", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 0;
    h.ui().trackCurrentPage[1] = 0;
    h.ui().lastPlayedNote = 60;
    const ac = h.ui().trackActiveClip[1] as number;
    h.ui().clipSteps[1][ac][7] = 0;
    h.ui().clipNonEmpty[1][ac] = false;
    h.ui().muteHeld = true;

    h.emu.sendInternal(0x90, 23, 127); // press step 8
    h.step(2);
    expect(h.ui().heldStep).toBe(7);

    h.emu.sendInternal(0x80, 23, 0);
    h.step(2);

    expect(h.ui().clipSteps[1][ac][7]).toBe(1);
    expect(h.ui().clipNonEmpty[1][ac]).toBe(true);
    expect(h.ui().heldStep).toBe(-1);

    h.ui().muteHeld = false;
    h.step(2);
  });

  test("plain melodic step tap assigns an empty step", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 0;
    h.ui().trackCurrentPage[1] = 0;
    h.ui().lastPlayedNote = 60;
    const ac = h.ui().trackActiveClip[1] as number;
    h.ui().clipSteps[1][ac][9] = 0;
    h.ui().clipNonEmpty[1][ac] = false;

    h.tapStep(9);
    h.step(2);

    expect(h.ui().clipSteps[1][ac][9]).toBe(1);
    expect(h.ui().clipNonEmpty[1][ac]).toBe(true);
    expect(h.ui().heldStep).toBe(-1);
  });

  test("melodic CC bank step press enters CC step edit setup", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 6;
    h.ui().trackCurrentPage[1] = 0;
    const ac = h.ui().trackActiveClip[1] as number;
    h.ui().clipSteps[1][ac][4] = 0;
    h.ui().ccStepEditActive = false;

    h.emu.sendInternal(0x90, 20, 127); // press step 5

    expect(h.ui().heldStep).toBe(4);
    expect(h.ui().ccStepEditActive).toBe(true);

    h.emu.sendInternal(0x80, 20, 0);
    h.step(2);
    h.ui().activeBank = 0;
  });

  test("melodic chord-first step press captures pending chord context", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 0;
    h.ui().trackCurrentPage[1] = 0;
    h.ui().liveActiveNotes = new Set([67, 60, 64]);
    h.ui().lastPadVelocity = 91;
    const ac = h.ui().trackActiveClip[1] as number;
    h.ui().clipSteps[1][ac][5] = 0;

    h.emu.sendInternal(0x90, 21, 127); // press step 6, do not tick yet

    expect(h.ui().pendingChordToStep).toEqual({
      t: 1,
      ac,
      step: 5,
      wasEmpty: true,
      pitches: [60, 64, 67],
      vel: 91,
    });
    expect(h.ui().stepBtnPressedTick[5]).toBe(-1);
    expect(h.ui().stepWasHeld).toBe(true);

    h.emu.sendInternal(0x80, 21, 0);
    h.ui().liveActiveNotes = new Set();
    h.step(2);
  });

  test("Loop + two steps in ALL LANES writes every drum lane range", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 7;
    h.ui().activeDrumLane[0] = 5;
    h.ui().drumStepPage[0] = 0;
    h.ui().drumLaneLengthManuallySet[0] = false;
    h.ui().pendingDrumResync = 0;
    h.ui().pendingDrumResyncTrack = -1;

    h.hold(58); // Loop
    h.emu.sendInternal(0x90, 18, 127); // step 3: arm
    h.step(2);
    h.emu.sendInternal(0x90, 21, 127); // step 6: B

    expect(h.ui().loopGestureFired).toBe(true);
    expect(h.ui().drumLaneLoopStart[0]).toBe(32);
    expect(h.ui().drumLaneLength[0]).toBe(64);
    expect(h.ui().drumLaneLengthManuallySet[0]).toBe(true);
    expect(h.ui().drumStepPage[0]).toBe(2);
    expect(h.ui().pendingDrumResync).toBe(2);
    expect(h.ui().pendingDrumResyncTrack).toBe(0);

    h.step(2);
    expect(h.get("t0_l0_loop_start")).toBe("32");
    expect(h.get("t0_l0_length")).toBe("64");
    expect(h.get("t0_l5_loop_start")).toBe("32");
    expect(h.get("t0_l5_length")).toBe("64");

    h.emu.sendInternal(0x80, 18, 0);
    h.emu.sendInternal(0x80, 21, 0);
    h.step(2);
    h.release(58);
    h.step(2);
  });

  test("Loop + two steps in CC automation bank sets active CC lane range", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 6;
    h.ui().trackCurrentPage[1] = 0;

    const ac = h.ui().trackActiveClip[1] as number;
    h.ui().ccActiveLane[1] = 0;
    h.ui().clipLoopStart[1][ac] = 0;
    h.ui().clipLength[1][ac] = 96;
    h.ui().ccLaneLoopStart[1][ac][0] = 0;
    h.ui().ccLaneLength[1][ac][0] = 96;
    h.set("t1_c0_length", "96");
    h.set("t1_c0_k0_cc_loop_set", 96);
    h.step(3);

    h.hold(58); // Loop
    h.emu.sendInternal(0x90, 19, 127); // step 4: arm
    h.step(2);
    h.emu.sendInternal(0x90, 21, 127); // step 6: B

    expect(h.ui().loopGestureFired).toBe(true);
    expect(h.ui().ccLaneLoopStart[1][ac][0]).toBe(48);
    expect(h.ui().ccLaneLength[1][ac][0]).toBe(48);
    expect(h.ui().clipLength[1][ac]).toBe(96);
    expect(h.ui().trackCurrentPage[1]).toBe(3);

    h.step(2);
    expect(h.get("t1_c0_length")).toBe("96");
    expect(h.get("t1_c0_cc_lane_loops")?.split(" ").slice(0, 2)).toEqual(["48", "48"]);

    h.emu.sendInternal(0x80, 19, 0);
    h.emu.sendInternal(0x80, 21, 0);
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

  test("Track View melodic Loop + jog changes active clip length", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 0;
    h.ui().trackCurrentPage[1] = 0;

    const ac = h.ui().trackActiveClip[1] as number;
    h.ui().clipLoopStart[1][ac] = 32;
    h.ui().clipLength[1][ac] = 33;
    h.ui().clipLengthManuallySet[1][ac] = false;
    h.set("t1_c0_loop_set", (32 << 16) | 33);
    h.step(3);

    h.hold(58); // Loop
    h.cc(14, 127); // jog ccw -> one step shorter

    expect(h.ui().clipLength[1][ac]).toBe(32);
    expect(h.ui().clipLengthManuallySet[1][ac]).toBe(true);
    expect(h.ui().trackCurrentPage[1]).toBe(3);

    h.step(3);
    expect(h.get("t1_c0_length")).toBe("32");
    h.release(58);
    h.step(2);
  });

  test("Track View drum Loop + jog changes active lane length", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;
    h.ui().drumStepPage[0] = 0;
    h.ui().drumLaneLoopStart[0] = 32;
    h.ui().drumLaneLength[0] = 33;
    h.ui().drumLaneLengthManuallySet[0] = false;
    h.set("t0_l0_loop_set", (32 << 16) | 33);
    h.step(3);

    h.hold(58); // Loop
    h.cc(14, 127); // jog ccw -> one step shorter

    expect(h.ui().drumLaneLength[0]).toBe(32);
    expect(h.ui().drumLaneLengthManuallySet[0]).toBe(true);
    expect(h.ui().drumStepPage[0]).toBe(3);

    h.step(3);
    expect(h.get("t0_l0_length")).toBe("32");
    h.release(58);
    h.step(2);
  });

  test("Track View Loop + jog is blocked during active recording", () => {
    noteView();
    h.ui().activeTrack = 0;
    h.ui().activeBank = 0;
    h.ui().activeDrumLane[0] = 0;
    h.ui().recordArmed = true;
    h.ui().recordCountingIn = false;
    h.ui().drumLaneLength[0] = 33;
    h.set("t0_l0_loop_set", 33);
    h.step(3);

    h.hold(58); // Loop
    h.cc(14, 1); // jog cw would lengthen if not blocked
    h.step(3);
    h.release(58);
    h.step(2);

    expect(h.ui().drumLaneLength[0]).toBe(33);
    expect(h.get("t0_l0_length")).toBe("33");

    h.ui().recordArmed = false;
  });

  test("CC automation bank Loop + jog edits active CC lane length", () => {
    noteView();
    h.ui().activeTrack = 1;
    h.ui().activeBank = 6;
    h.ui().trackCurrentPage[1] = 0;

    const ac = h.ui().trackActiveClip[1] as number;
    h.ui().ccActiveLane[1] = 0;
    h.ui().clipLoopStart[1][ac] = 0;
    h.ui().clipLength[1][ac] = 64;
    h.ui().ccLaneLoopStart[1][ac][0] = 32;
    h.ui().ccLaneLength[1][ac][0] = 33;
    h.set("t1_c0_length", "64");
    h.set("t1_c0_k0_cc_loop_set", (32 << 16) | 33);
    h.step(3);

    h.hold(58); // Loop
    h.cc(14, 127); // jog ccw -> one step shorter

    expect(h.ui().ccLaneLength[1][ac][0]).toBe(32);
    expect(h.ui().clipLength[1][ac]).toBe(64);
    expect(h.ui().trackCurrentPage[1]).toBe(3);

    h.step(3);
    expect(h.get("t1_c0_length")).toBe("64");
    h.release(58);
    h.step(2);
  });
});
