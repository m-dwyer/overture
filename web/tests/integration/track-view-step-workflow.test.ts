import { describe, expect, test } from "vitest";
import {
  handleTrackViewCopyStepPress,
  handleTrackViewDeleteStepPress,
  handleTrackViewMuteStepPress,
  handleTrackViewShiftStepPress,
  handleTrackViewDrumStepPress,
  handleTrackViewMelodicStepPress,
  handleTrackViewStepRelease,
  handleTrackViewStepHoldThreshold,
  handleTrackViewChordFirstStepTick,
} from "@tool-ui/ui_track_view_step_workflow.mjs";

function calls() {
  const log: Array<[string, ...unknown[]]> = [];
  return {
    log,
    fn(name: string) {
      return (...args: unknown[]) => log.push([name, ...args]);
    },
  };
}

function deps(c: ReturnType<typeof calls>, overrides = {}) {
  return {
    applyBankParam: c.fn("applyBankParam"),
    applyTrackConfig: c.fn("applyTrackConfig"),
    clearStep: c.fn("clearStep"),
    computePadNoteMap: c.fn("computePadNoteMap"),
    copyStep: c.fn("copyStep"),
    cycleDrumRepeatPerformMode: c.fn("cycleDrumRepeatPerformMode"),
    doDoubleFill: c.fn("doDoubleFill"),
    doLaneDoubleFill: c.fn("doLaneDoubleFill"),
    doShiftStepCommon: c.fn("shiftCommon"),
    effectiveClip: c.fn("effectiveClip"),
    effectiveVelocity: c.fn("effectiveVelocity"),
    clipHasContent: c.fn("clipHasContent"),
    getParam: (...args: unknown[]) => {
      c.log.push(["getParam", ...args]);
      return null;
    },
    invalidateLEDCache: c.fn("invalidate"),
    forceRedraw: c.fn("redraw"),
    noNoteFlashTicks: 32,
    padModeDrum: 1,
    refreshSeqNotesIfCurrent: c.fn("refreshSeqNotes"),
    setParam: c.fn("setParam"),
    stepHoldTicks: 19,
    stepEntryVelocity: (...args: unknown[]) => {
      c.log.push(["stepEntryVelocity", ...args]);
      return 96;
    },
    showActionPopup: c.fn("popup"),
    ...overrides,
  };
}

function state(overrides = {}) {
  return {
    copyHeld: true,
    copySrc: null,
    activeTrack: 2,
    trackCurrentPage: [0, 0, 3],
    deleteHeld: false,
    muteHeld: false,
    shiftHeld: false,
    tickCount: 123,
    heldStep: -1,
    heldStepBtn: -1,
    heldStepNotes: [],
    stepWasEmpty: false,
    stepWasHeld: false,
    stepBtnPressedTick: Array(16).fill(-1),
    stepEditVel: 0,
    stepEditGate: 0,
    stepEditNudge: 0,
    stepEditIter: 0,
    stepEditRand: 0,
    stepEditRatch: 0,
    activeBank: 0,
    noNoteFlashEndTick: -1,
    screenDirty: false,
    ccStepEditActive: false,
    ccStepEditSet: Array(8).fill(false),
    ccStepEditComputed: Array(8).fill(-1),
    ccStepEditVal: Array(8).fill(0),
    pendingChordToStep: null,
    pendingChordPhase2: null,
    liveActiveNotes: new Set<number>(),
    lastPadVelocity: 87,
    lastPlayedNote: 60,
    trackPadMode: [1, 0, 0],
    padLayoutChromatic: [false, false, false],
    trackVelOverride: [0, 0, 100],
    bankParams: Array.from({ length: 3 }, () =>
      Array.from({ length: 8 }, () => new Array(8).fill(0))
    ),
    lastTarpStyle: [2, 3, 4],
    drumLaneQnt: [64, 64, 64],
    drumLaneNote: [
      Array.from({ length: 32 }, (_, i) => 36 + i),
      Array.from({ length: 32 }, (_, i) => 36 + i),
      Array.from({ length: 32 }, (_, i) => 36 + i),
    ],
    drumLaneLength: [64, 64, 64],
    drumLaneTPS: [24, 24, 24],
    clipTPS: [
      [24],
      [24],
      [24, 24],
    ],
    clipSteps: [
      [Array(64).fill(0)],
      [Array(64).fill(0)],
      [Array(64).fill(0), Array(64).fill(0)],
    ],
    clipNonEmpty: [
      [false],
      [false],
      [false, false],
    ],
    clipLength: [
      [64],
      [64],
      [64, 64],
    ],
    ccActiveLane: [0, 0, 1],
    ccLaneTps: [
      [[0]],
      [[0]],
      [[0], [0, 48, 0]],
    ],
    clipCCVal: [
      [Array(8).fill(-1)],
      [Array(8).fill(-1)],
      [Array(8).fill(-1), [10, -1, 20, -1, 30, -1, 40, -1]],
    ],
    pendingCCBitsRefresh: -1,
    undoAvailable: false,
    redoAvailable: true,
    undoSeqArpSnapshot: { captured: true },
    activeDrumLane: [4, 0, 0],
    trackActiveClip: [0, 0, 1],
    drumClipNonEmpty: [
      [false],
      [false],
      [false, false],
    ],
    drumStepPage: [2, 0, 0],
    drumLaneSteps: [
      Array.from({ length: 32 }, () => Array(64).fill("0")),
      Array.from({ length: 32 }, () => Array(64).fill("0")),
      Array.from({ length: 32 }, () => Array(64).fill("0")),
    ],
    drumLaneHasNotes: [
      Array(32).fill(false),
      Array(32).fill(false),
      Array(32).fill(false),
    ],
    pendingDrumLaneResync: 0,
    pendingDrumLaneResyncTrack: -1,
    pendingDrumLaneResyncLane: -1,
    pendingStepsReread: 0,
    pendingStepsRereadTrack: -1,
    pendingStepsRereadClip: -1,
    ...overrides,
  };
}

describe("Track View Step Workflow", () => {
  test("Copy+first step captures a step source and invalidates LEDs", () => {
    const c = calls();
    const S = state();

    expect(handleTrackViewCopyStepPress(S, deps(c), 5)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "step", absStep: 53 });
    expect(c.log).toEqual([
      ["effectiveClip", 2],
      ["invalidate"],
    ]);
  });

  test("Copy+second step copies source step to target step in the active clip", () => {
    const c = calls();
    const S = state({ copySrc: { kind: "step", absStep: 50 } });

    expect(handleTrackViewCopyStepPress(S, deps(c), 8)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "step", absStep: 50 });
    expect(c.log).toEqual([
      ["effectiveClip", 2],
      ["copyStep", 2, 1, 50, 56],
      ["invalidate"],
      ["redraw"],
    ]);
  });

  test("Copy+same step does not copy but preserves refresh behavior", () => {
    const c = calls();
    const S = state({ copySrc: { kind: "step", absStep: 53 } });

    expect(handleTrackViewCopyStepPress(S, deps(c), 5)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "step", absStep: 53 });
    expect(c.log).toEqual([
      ["effectiveClip", 2],
      ["invalidate"],
      ["redraw"],
    ]);
  });

  test("existing non-step copy source is swallowed and does not mix copy kinds", () => {
    const c = calls();
    const S = state({ copySrc: { kind: "clip", track: 1, clip: 4 } });

    expect(handleTrackViewCopyStepPress(S, deps(c), 5)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "clip", track: 1, clip: 4 });
    expect(c.log).toEqual([
      ["effectiveClip", 2],
    ]);
  });

  test("plain step press is ignored by the Copy+step workflow", () => {
    const c = calls();
    const S = state({ copyHeld: false });

    expect(handleTrackViewCopyStepPress(S, deps(c), 5)).toBe(false);

    expect(S.copySrc).toBe(null);
    expect(c.log).toEqual([]);
  });

  test("Delete+step on melodic normal bank clears the active clip step and redraws", () => {
    const c = calls();
    const S = state({ deleteHeld: true, activeBank: 0 });

    expect(handleTrackViewDeleteStepPress(S, deps(c), 6)).toBe(true);

    expect(c.log).toEqual([
      ["effectiveClip", 2],
      ["clearStep", 2, 1, 54],
      ["redraw"],
    ]);
  });

  test("Delete+step on melodic CC automation bank clears the whole step range", () => {
    const c = calls();
    const S = state({ deleteHeld: true, activeBank: 6 });

    expect(handleTrackViewDeleteStepPress(S, deps(c), 3)).toBe(true);

    expect(S.undoAvailable).toBe(true);
    expect(S.redoAvailable).toBe(false);
    expect(S.undoSeqArpSnapshot).toBe(null);
    expect(S.pendingCCBitsRefresh).toBe(1);
    expect(c.log).toEqual([
      ["effectiveClip", 2],
      ["setParam", "t2_cc_auto_clear_step", "1 2448 2495"],
      ["popup", "CC STEP", "CLEAR"],
      ["invalidate"],
      ["redraw"],
    ]);
  });

  test("Delete+step on melodic CC automation bank falls back to clip ticks per step", () => {
    const c = calls();
    const S = state({
      deleteHeld: true,
      activeBank: 6,
      ccLaneTps: [
        [[0]],
        [[0]],
        [[0], [0, 0, 0]],
      ],
    });

    expect(handleTrackViewDeleteStepPress(S, deps(c), 3)).toBe(true);

    expect(c.log).toContainEqual(["setParam", "t2_cc_auto_clear_step", "1 1224 1247"]);
  });

  test("Delete+step on drum track clears the active lane step mirror and redraws", () => {
    const c = calls();
    const drumSteps = Array.from({ length: 32 }, () => Array(64).fill("0"));
    drumSteps[4][37] = "1";
    const S = state({
      activeTrack: 0,
      trackPadMode: [1, 0, 0],
      deleteHeld: true,
      activeBank: 0,
      drumLaneSteps: [
        drumSteps,
        Array.from({ length: 32 }, () => Array(64).fill("0")),
        Array.from({ length: 32 }, () => Array(64).fill("0")),
      ],
      drumLaneHasNotes: [
        [false, false, false, false, true, ...Array(27).fill(false)],
        Array(32).fill(false),
        Array(32).fill(false),
      ],
    });

    expect(handleTrackViewDeleteStepPress(S, deps(c), 5)).toBe(true);

    expect(S.drumLaneSteps[0][4][37]).toBe("0");
    expect(S.drumLaneHasNotes[0][4]).toBe(false);
    expect(c.log).toEqual([
      ["setParam", "t0_l4_step_37_clear", "1"],
      ["redraw"],
    ]);
  });

  test("plain step press is ignored by the Delete+step workflow", () => {
    const c = calls();
    const S = state({ deleteHeld: false });

    expect(handleTrackViewDeleteStepPress(S, deps(c), 5)).toBe(false);

    expect(c.log).toEqual([]);
  });

  test("Mute+step is intentionally left to the normal Track View step handlers", () => {
    const c = calls();
    const S = state({ copyHeld: false, deleteHeld: false, muteHeld: true });

    expect(handleTrackViewMuteStepPress(S, deps(c), 5)).toBe(false);

    expect(c.log).toEqual([]);
  });

  test("plain step press is ignored by the Mute+step workflow", () => {
    const c = calls();
    const S = state({ copyHeld: false, deleteHeld: false, muteHeld: false });

    expect(handleTrackViewMuteStepPress(S, deps(c), 5)).toBe(false);

    expect(c.log).toEqual([]);
  });

  test("plain step press is ignored by the Shift+step workflow", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: false });

    expect(handleTrackViewShiftStepPress(S, deps(c), 7)).toBe(false);

    expect(c.log).toEqual([]);
  });

  test("Shift+step 8 on a drum track cycles drum repeat perform mode", () => {
    const c = calls();
    const S = state({ activeTrack: 0, copyHeld: false, shiftHeld: true });

    expect(handleTrackViewShiftStepPress(S, deps(c), 7)).toBe(true);

    expect(c.log).toEqual([
      ["shiftCommon", 7],
      ["cycleDrumRepeatPerformMode", 0],
      ["redraw"],
    ]);
  });

  test("Shift+step 8 on a melodic track toggles chromatic layout and recomputes pad map", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true, padLayoutChromatic: [false, false, false] });

    expect(handleTrackViewShiftStepPress(S, deps(c), 7)).toBe(true);

    expect(S.padLayoutChromatic[2]).toBe(true);
    expect(c.log).toEqual([
      ["shiftCommon", 7],
      ["computePadNoteMap"],
      ["popup", "CHROMATIC"],
      ["redraw"],
    ]);
  });

  test("Shift+step 10 toggles VelIn between Live and 100", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true, trackVelOverride: [0, 0, 0] });

    expect(handleTrackViewShiftStepPress(S, deps(c), 9)).toBe(true);

    expect(c.log).toEqual([
      ["shiftCommon", 9],
      ["applyTrackConfig", 2, "track_vel_override", 100],
      ["redraw"],
    ]);
  });

  test("Shift+step 10 toggles VelIn back to Live", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true, trackVelOverride: [0, 0, 100] });

    expect(handleTrackViewShiftStepPress(S, deps(c), 9)).toBe(true);

    expect(c.log).toEqual([
      ["shiftCommon", 9],
      ["applyTrackConfig", 2, "track_vel_override", 0],
      ["redraw"],
    ]);
  });

  test("Shift+step 11 toggles melodic TRACK ARP style off", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true });
    S.bankParams[2][5][0] = 5;

    expect(handleTrackViewShiftStepPress(S, deps(c), 10)).toBe(true);

    expect(S.bankParams[2][5][0]).toBe(0);
    expect(c.log).toEqual([
      ["shiftCommon", 10],
      ["applyBankParam", 2, 5, 0, 0],
      ["redraw"],
    ]);
  });

  test("Shift+step 11 toggles melodic TRACK ARP style back to last style", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true, lastTarpStyle: [2, 3, 6] });
    S.bankParams[2][5][0] = 0;

    expect(handleTrackViewShiftStepPress(S, deps(c), 10)).toBe(true);

    expect(S.bankParams[2][5][0]).toBe(6);
    expect(c.log).toEqual([
      ["shiftCommon", 10],
      ["applyBankParam", 2, 5, 0, 6],
      ["redraw"],
    ]);
  });

  test("Shift+step 11 is ignored on drum tracks except for common shortcut and redraw", () => {
    const c = calls();
    const S = state({ activeTrack: 0, copyHeld: false, shiftHeld: true });
    S.bankParams[0][5][0] = 5;

    expect(handleTrackViewShiftStepPress(S, deps(c), 10)).toBe(true);

    expect(S.bankParams[0][5][0]).toBe(5);
    expect(c.log).toEqual([
      ["shiftCommon", 10],
      ["redraw"],
    ]);
  });

  test("Shift+step 15 on melodic CC automation bank calls lane double-fill", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true, activeBank: 6 });

    expect(handleTrackViewShiftStepPress(S, deps(c), 14)).toBe(true);

    expect(c.log).toEqual([
      ["shiftCommon", 14],
      ["doLaneDoubleFill"],
      ["redraw"],
    ]);
  });

  test("Shift+step 15 on other banks calls normal double-fill", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true, activeBank: 0 });

    expect(handleTrackViewShiftStepPress(S, deps(c), 14)).toBe(true);

    expect(c.log).toEqual([
      ["shiftCommon", 14],
      ["doDoubleFill"],
      ["redraw"],
    ]);
  });

  test("Shift+step 16 on melodic non-CC bank writes quantize 100 and updates NOTE FX mirror", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true, activeBank: 0 });

    expect(handleTrackViewShiftStepPress(S, deps(c), 15)).toBe(true);

    expect(S.bankParams[2][1][3]).toBe(100);
    expect(c.log).toEqual([
      ["shiftCommon", 15],
      ["setParam", "t2_quantize", "100"],
      ["popup", "QUANT 100%"],
      ["redraw"],
    ]);
  });

  test("Shift+step 16 on drum active-lane bank writes active lane quantize and updates mirrors", () => {
    const c = calls();
    const S = state({ activeTrack: 0, copyHeld: false, shiftHeld: true, activeBank: 0 });

    expect(handleTrackViewShiftStepPress(S, deps(c), 15)).toBe(true);

    expect(S.drumLaneQnt[0]).toBe(100);
    expect(S.bankParams[0][1][2]).toBe(100);
    expect(c.log).toEqual([
      ["shiftCommon", 15],
      ["setParam", "t0_l4_pfx_set", "quantize 100"],
      ["popup", "QUANT 100%"],
      ["redraw"],
    ]);
  });

  test("Shift+step 16 on drum ALL LANES bank writes all-lanes quantize and updates mirrors", () => {
    const c = calls();
    const S = state({ activeTrack: 0, copyHeld: false, shiftHeld: true, activeBank: 7 });

    expect(handleTrackViewShiftStepPress(S, deps(c), 15)).toBe(true);

    expect(S.drumLaneQnt[0]).toBe(100);
    expect(S.bankParams[0][7][3]).toBe(100);
    expect(S.bankParams[0][1][2]).toBe(100);
    expect(c.log).toEqual([
      ["shiftCommon", 15],
      ["setParam", "t0_drum_lanes_qnt", "100"],
      ["popup", "QUANT 100%"],
      ["redraw"],
    ]);
  });

  test("Shift+step 16 on CC automation bank does not quantize", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true, activeBank: 6 });

    expect(handleTrackViewShiftStepPress(S, deps(c), 15)).toBe(true);

    expect(S.bankParams[2][1][3]).toBe(0);
    expect(c.log).toEqual([
      ["shiftCommon", 15],
      ["redraw"],
    ]);
  });

  test("plain melodic step press is ignored by the drum step workflow", () => {
    const c = calls();
    const S = state({ copyHeld: false, activeTrack: 2, trackPadMode: [1, 0, 0] });

    expect(handleTrackViewDrumStepPress(S, deps(c), 5)).toBe(false);

    expect(c.log).toEqual([]);
  });

  test("Shift+step is ignored by the drum step workflow", () => {
    const c = calls();
    const S = state({ activeTrack: 0, copyHeld: false, shiftHeld: true });

    expect(handleTrackViewDrumStepPress(S, deps(c), 5)).toBe(false);

    expect(c.log).toEqual([]);
  });

  test("drum first press on empty step records hold state and default edit values", () => {
    const c = calls();
    const S = state({ activeTrack: 0, copyHeld: false, tickCount: 321 });

    expect(handleTrackViewDrumStepPress(S, deps(c), 5)).toBe(true);

    expect(S.stepBtnPressedTick[5]).toBe(321);
    expect(S.heldStepBtn).toBe(5);
    expect(S.heldStep).toBe(37);
    expect(S.stepWasEmpty).toBe(true);
    expect(S.heldStepNotes).toEqual([]);
    expect(S.stepEditVel).toBe(96);
    expect(S.stepEditGate).toBe(12);
    expect(S.stepEditNudge).toBe(0);
    expect(S.stepEditIter).toBe(0);
    expect(S.stepEditRand).toBe(0);
    expect(S.stepEditRatch).toBe(0);
    expect(c.log).toEqual([
      ["stepEntryVelocity", 0, -1, true],
      ["redraw"],
    ]);
  });

  test("drum first press on occupied step reads edit values and marks notes present", () => {
    const c = calls();
    const drumSteps = Array.from({ length: 32 }, () => Array(64).fill("0"));
    drumSteps[4][37] = "1";
    const getValues = new Map([
      ["t0_l4_step_37_vel", "77"],
      ["t0_l4_step_37_gate", "18"],
      ["t0_l4_step_37_nudge", "-3"],
      ["t0_l4_step_37_iter", "2"],
      ["t0_l4_step_37_rand", "5"],
      ["t0_l4_step_37_ratch", "1"],
    ]);
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      drumLaneSteps: [
        drumSteps,
        Array.from({ length: 32 }, () => Array(64).fill("0")),
        Array.from({ length: 32 }, () => Array(64).fill("0")),
      ],
    });

    expect(handleTrackViewDrumStepPress(S, deps(c, {
      getParam: (key: string) => {
        c.log.push(["getParam", key]);
        return getValues.get(key) ?? null;
      },
    }), 5)).toBe(true);

    expect(S.stepWasEmpty).toBe(false);
    expect(S.heldStepNotes).toEqual([40]);
    expect(S.stepEditVel).toBe(77);
    expect(S.stepEditGate).toBe(18);
    expect(S.stepEditNudge).toBe(-3);
    expect(S.stepEditIter).toBe(2);
    expect(S.stepEditRand).toBe(5);
    expect(S.stepEditRatch).toBe(1);
    expect(c.log).toEqual([
      ["getParam", "t0_l4_step_37_vel"],
      ["getParam", "t0_l4_step_37_gate"],
      ["getParam", "t0_l4_step_37_nudge"],
      ["getParam", "t0_l4_step_37_iter"],
      ["getParam", "t0_l4_step_37_rand"],
      ["getParam", "t0_l4_step_37_ratch"],
      ["redraw"],
    ]);
  });

  test("drum second press during primary tap window toggles an empty step immediately", () => {
    const c = calls();
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      heldStep: 32,
      heldStepBtn: 0,
      stepBtnPressedTick: [100, ...Array(15).fill(-1)],
    });

    expect(handleTrackViewDrumStepPress(S, deps(c), 5)).toBe(true);

    expect(S.drumLaneSteps[0][4][37]).toBe("1");
    expect(S.drumLaneHasNotes[0][4]).toBe(true);
    expect(S.stepBtnPressedTick[5]).toBe(-1);
    expect(c.log).toEqual([
      ["stepEntryVelocity", 0, -1, true],
      ["setParam", "t0_l4_step_37_toggle", "96"],
      ["redraw"],
    ]);
  });

  test("drum second press during primary tap window clears an occupied step immediately", () => {
    const c = calls();
    const drumSteps = Array.from({ length: 32 }, () => Array(64).fill("0"));
    drumSteps[4][37] = "1";
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      heldStep: 32,
      heldStepBtn: 0,
      stepBtnPressedTick: [100, ...Array(15).fill(-1)],
      drumLaneSteps: [
        drumSteps,
        Array.from({ length: 32 }, () => Array(64).fill("0")),
        Array.from({ length: 32 }, () => Array(64).fill("0")),
      ],
      drumLaneHasNotes: [
        [false, false, false, false, true, ...Array(27).fill(false)],
        Array(32).fill(false),
        Array(32).fill(false),
      ],
    });

    expect(handleTrackViewDrumStepPress(S, deps(c), 5)).toBe(true);

    expect(S.drumLaneSteps[0][4][37]).toBe("0");
    expect(S.drumLaneHasNotes[0][4]).toBe(false);
    expect(S.stepBtnPressedTick[5]).toBe(-1);
    expect(c.log).toEqual([
      ["setParam", "t0_l4_step_37_clear", "1"],
      ["redraw"],
    ]);
  });

  test("drum second press during held step edit sets gate span through tapped step", () => {
    const c = calls();
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      heldStep: 34,
      heldStepBtn: 2,
      heldStepNotes: [40],
      stepBtnPressedTick: Array(16).fill(-1),
    });

    expect(handleTrackViewDrumStepPress(S, deps(c), 5)).toBe(true);

    expect(S.stepWasHeld).toBe(true);
    expect(S.stepEditGate).toBe(96);
    expect(c.log).toEqual([
      ["setParam", "t0_l4_step_34_gate", "96"],
      ["redraw"],
    ]);
  });

  test("drum second press during held step edit wraps gate span around lane length", () => {
    const c = calls();
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      heldStep: 62,
      heldStepBtn: 14,
      heldStepNotes: [40],
      drumStepPage: [0, 0, 0],
      stepBtnPressedTick: Array(16).fill(-1),
    });

    expect(handleTrackViewDrumStepPress(S, deps(c), 1)).toBe(true);

    expect(S.stepEditGate).toBe(96);
    expect(c.log).toEqual([
      ["setParam", "t0_l4_step_62_gate", "96"],
      ["redraw"],
    ]);
  });

  test("drum tracks are ignored by the melodic step workflow", () => {
    const c = calls();
    const S = state({ activeTrack: 0, copyHeld: false });

    expect(handleTrackViewMelodicStepPress(S, deps(c), 5)).toBe(false);

    expect(c.log).toEqual([]);
  });

  test("Shift+step is ignored by the melodic step workflow", () => {
    const c = calls();
    const S = state({ copyHeld: false, shiftHeld: true });

    expect(handleTrackViewMelodicStepPress(S, deps(c), 5)).toBe(false);

    expect(c.log).toEqual([]);
  });

  test("melodic first press on empty step records hold state and default edit values", () => {
    const c = calls();
    const S = state({ copyHeld: false, tickCount: 222 });

    expect(handleTrackViewMelodicStepPress(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.stepBtnPressedTick[5]).toBe(222);
    expect(S.heldStepBtn).toBe(5);
    expect(S.heldStep).toBe(53);
    expect(S.stepWasEmpty).toBe(true);
    expect(S.heldStepNotes).toEqual([]);
    expect(S.stepEditVel).toBe(100);
    expect(S.stepEditGate).toBe(24);
    expect(S.stepEditNudge).toBe(0);
    expect(S.stepEditIter).toBe(0);
    expect(S.stepEditRand).toBe(0);
    expect(S.stepEditRatch).toBe(0);
    expect(S.ccStepEditActive).toBe(false);
    expect(c.log).toEqual([["redraw"]]);
  });

  test("melodic first press on non-empty step defers note read until hold threshold", () => {
    const c = calls();
    const clipSteps = [
      [Array(64).fill(0)],
      [Array(64).fill(0)],
      [Array(64).fill(0), Array(64).fill(0)],
    ];
    clipSteps[2][1][53] = 1;
    const S = state({ copyHeld: false, clipSteps });

    expect(handleTrackViewMelodicStepPress(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.stepWasEmpty).toBe(false);
    expect(S.heldStepNotes).toEqual([]);
    expect(S.stepEditVel).toBe(100);
    expect(S.stepEditGate).toBe(24);
    expect(c.log).toEqual([["redraw"]]);
  });

  test("melodic CC bank first press marks CC step edit active", () => {
    const c = calls();
    const S = state({ copyHeld: false, activeBank: 6 });

    expect(handleTrackViewMelodicStepPress(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.ccStepEditActive).toBe(true);
    expect(S.stepWasEmpty).toBe(true);
    expect(S.stepEditVel).toBe(0);
    expect(c.log).toEqual([["redraw"]]);
  });

  test("melodic chord-first press captures pending chord context and bypasses tap-toggle", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      liveActiveNotes: new Set([67, 60, 64]),
      lastPadVelocity: 90,
    });

    expect(handleTrackViewMelodicStepPress(S, deps(c, {
      effectiveClip: () => 1,
      effectiveVelocity: (raw: number) => {
        c.log.push(["effectiveVelocity", raw]);
        return raw;
      },
    }), 5)).toBe(true);

    expect(S.pendingChordToStep).toEqual({
      t: 2,
      ac: 1,
      step: 53,
      wasEmpty: true,
      pitches: [60, 64, 67],
      vel: 96,
    });
    expect(S.stepBtnPressedTick[5]).toBe(-1);
    expect(S.stepWasHeld).toBe(true);
    expect(c.log).toEqual([
      ["effectiveVelocity", 90],
      ["stepEntryVelocity", 2, 90, false],
      ["redraw"],
    ]);
  });

  test("chord-first tick phase 1 toggles an empty step and schedules phase 2", () => {
    const c = calls();
    const pending = {
      t: 2,
      ac: 1,
      step: 53,
      wasEmpty: true,
      pitches: [60, 64, 67],
      vel: 96,
    };
    const S = state({
      copyHeld: false,
      pendingChordToStep: pending,
    });

    expect(handleTrackViewChordFirstStepTick(S, deps(c))).toBe(true);

    expect(S.clipSteps[2][1][53]).toBe(1);
    expect(S.clipNonEmpty[2][1]).toBe(true);
    expect(S.pendingChordPhase2).toBe(pending);
    expect(S.pendingChordToStep).toBe(null);
    expect(c.log).toEqual([
      ["setParam", "t2_c1_step_53_toggle", "60 96"],
    ]);
  });

  test("chord-first tick phase 1 schedules phase 2 without toggling an existing step", () => {
    const c = calls();
    const pending = {
      t: 2,
      ac: 1,
      step: 53,
      wasEmpty: false,
      pitches: [60, 64, 67],
      vel: 96,
    };
    const S = state({
      copyHeld: false,
      pendingChordToStep: pending,
    });

    expect(handleTrackViewChordFirstStepTick(S, deps(c))).toBe(true);

    expect(S.pendingChordPhase2).toBe(pending);
    expect(S.pendingChordToStep).toBe(null);
    expect(c.log).toEqual([]);
  });

  test("chord-first tick phase 1 is deferred on the CC bank", () => {
    const c = calls();
    const pending = {
      t: 2,
      ac: 1,
      step: 53,
      wasEmpty: true,
      pitches: [60, 64, 67],
      vel: 96,
    };
    const S = state({
      copyHeld: false,
      activeBank: 6,
      pendingChordToStep: pending,
    });

    expect(handleTrackViewChordFirstStepTick(S, deps(c))).toBe(false);

    expect(S.pendingChordToStep).toBe(pending);
    expect(S.pendingChordPhase2).toBe(null);
    expect(c.log).toEqual([]);
  });

  test("chord-first tick phase 2 writes full chord notes and refreshes state", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      pendingChordPhase2: {
        t: 2,
        ac: 1,
        step: 53,
        wasEmpty: true,
        pitches: [60, 64, 67],
        vel: 96,
      },
    });

    expect(handleTrackViewChordFirstStepTick(S, deps(c))).toBe(true);

    expect(S.pendingChordPhase2).toBe(null);
    expect(S.heldStepNotes).toEqual([60, 64, 67]);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["setParam", "t2_c1_step_53_set_notes", "60 64 67"],
      ["refreshSeqNotes", 2, 1, 53],
    ]);
  });

  test("chord-first tick phase 2 refreshes single-note captures without set_notes", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      pendingChordPhase2: {
        t: 2,
        ac: 1,
        step: 53,
        wasEmpty: true,
        pitches: [60],
        vel: 96,
      },
    });

    expect(handleTrackViewChordFirstStepTick(S, deps(c))).toBe(true);

    expect(S.heldStepNotes).toEqual([60]);
    expect(c.log).toEqual([
      ["refreshSeqNotes", 2, 1, 53],
    ]);
  });

  test("melodic second press during primary tap window assigns an empty step", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      heldStep: 48,
      heldStepBtn: 0,
      stepBtnPressedTick: [100, ...Array(15).fill(-1)],
      lastPlayedNote: 62,
    });

    expect(handleTrackViewMelodicStepPress(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.clipSteps[2][1][53]).toBe(1);
    expect(S.clipNonEmpty[2][1]).toBe(true);
    expect(S.stepBtnPressedTick[5]).toBe(-1);
    expect(c.log).toEqual([
      ["stepEntryVelocity", 2, -1, false],
      ["setParam", "t2_c1_step_53_toggle", "62 96"],
      ["refreshSeqNotes", 2, 1, 53],
      ["redraw"],
    ]);
  });

  test("melodic second press during primary tap window deactivates an active step", () => {
    const c = calls();
    const clipSteps = [
      [Array(64).fill(0)],
      [Array(64).fill(0)],
      [Array(64).fill(0), Array(64).fill(0)],
    ];
    clipSteps[2][1][53] = 1;
    const S = state({
      copyHeld: false,
      heldStep: 48,
      heldStepBtn: 0,
      stepBtnPressedTick: [100, ...Array(15).fill(-1)],
      clipSteps,
      clipNonEmpty: [[false], [false], [false, true]],
    });

    expect(handleTrackViewMelodicStepPress(S, deps(c, {
      effectiveClip: () => 1,
      clipHasContent: (track: number, clip: number) => {
        c.log.push(["clipHasContent", track, clip]);
        return false;
      },
    }), 5)).toBe(true);

    expect(S.clipSteps[2][1][53]).toBe(2);
    expect(S.clipNonEmpty[2][1]).toBe(false);
    expect(c.log).toEqual([
      ["setParam", "t2_c1_step_53", "0"],
      ["clipHasContent", 2, 1],
      ["refreshSeqNotes", 2, 1, 53],
      ["redraw"],
    ]);
  });

  test("melodic second press during primary tap window reactivates an inactive step", () => {
    const c = calls();
    const clipSteps = [
      [Array(64).fill(0)],
      [Array(64).fill(0)],
      [Array(64).fill(0), Array(64).fill(0)],
    ];
    clipSteps[2][1][53] = 2;
    const S = state({
      copyHeld: false,
      heldStep: 48,
      heldStepBtn: 0,
      stepBtnPressedTick: [100, ...Array(15).fill(-1)],
      clipSteps,
    });

    expect(handleTrackViewMelodicStepPress(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.clipSteps[2][1][53]).toBe(1);
    expect(S.clipNonEmpty[2][1]).toBe(true);
    expect(c.log).toEqual([
      ["setParam", "t2_c1_step_53", "1"],
      ["refreshSeqNotes", 2, 1, 53],
      ["redraw"],
    ]);
  });

  test("melodic second press during held step edit sets gate span through tapped step", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      heldStep: 50,
      heldStepBtn: 2,
      heldStepNotes: [60],
      stepEditGate: 24,
      stepBtnPressedTick: Array(16).fill(-1),
    });

    expect(handleTrackViewMelodicStepPress(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.stepWasHeld).toBe(true);
    expect(S.stepEditGate).toBe(96);
    expect(c.log).toEqual([
      ["setParam", "t2_c1_step_50_gate", "96"],
      ["redraw"],
    ]);
  });

  test("melodic held step gate tap shrinks when gate already spans through tapped step", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      heldStep: 50,
      heldStepBtn: 2,
      heldStepNotes: [60],
      stepEditGate: 96,
      stepBtnPressedTick: Array(16).fill(-1),
    });

    expect(handleTrackViewMelodicStepPress(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.stepEditGate).toBe(72);
    expect(c.log).toEqual([
      ["setParam", "t2_c1_step_50_gate", "72"],
      ["redraw"],
    ]);
  });

  test("release of unrelated step is ignored by Track View release workflow", () => {
    const c = calls();
    const S = state({ copyHeld: false, heldStepBtn: 4, heldStep: 52 });

    expect(handleTrackViewStepRelease(S, deps(c), 5)).toBe(false);

    expect(S.heldStepBtn).toBe(4);
    expect(c.log).toEqual([]);
  });

  test("drum tap release assigns an empty held step and exits step edit", () => {
    const c = calls();
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      heldStepBtn: 5,
      heldStep: 37,
      stepWasEmpty: true,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 200, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepRelease(S, deps(c, {
      getParam: (key: string) => {
        c.log.push(["getParam", key]);
        return "1";
      },
    }), 5)).toBe(true);

    expect(S.drumLaneSteps[0][4][37]).toBe("1");
    expect(S.drumLaneHasNotes[0][4]).toBe(true);
    expect(S.drumClipNonEmpty[0][0]).toBe(true);
    expect(S.heldStep).toBe(-1);
    expect(S.stepWasEmpty).toBe(false);
    expect(c.log).toEqual([
      ["stepEntryVelocity", 0, -1, true],
      ["setParam", "t0_l4_step_37_toggle", "96"],
      ["getParam", "t0_c0_drum_has_content"],
      ["redraw"],
    ]);
  });

  test("drum tap release clears an occupied held step and does not confirm velocity", () => {
    const c = calls();
    const drumSteps = Array.from({ length: 32 }, () => Array(64).fill("0"));
    drumSteps[4][37] = "1";
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      heldStepBtn: 5,
      heldStep: 37,
      heldStepNotes: [40],
      stepWasEmpty: false,
      stepEditVel: 77,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 200, ...Array(10).fill(-1)],
      drumLaneSteps: [
        drumSteps,
        Array.from({ length: 32 }, () => Array(64).fill("0")),
        Array.from({ length: 32 }, () => Array(64).fill("0")),
      ],
      drumLaneHasNotes: [
        [false, false, false, false, true, ...Array(27).fill(false)],
        Array(32).fill(false),
        Array(32).fill(false),
      ],
    });

    expect(handleTrackViewStepRelease(S, deps(c), 5)).toBe(true);

    expect(S.drumLaneSteps[0][4][37]).toBe("0");
    expect(S.drumLaneHasNotes[0][4]).toBe(false);
    expect(c.log).toEqual([
      ["setParam", "t0_l4_step_37_clear", "1"],
      ["getParam", "t0_c0_drum_has_content"],
      ["redraw"],
    ]);
  });

  test("drum hold release reassigns when nudge crosses the lane midpoint", () => {
    const c = calls();
    const drumSteps = Array.from({ length: 32 }, () => Array(64).fill("0"));
    drumSteps[4][37] = "1";
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      heldStepBtn: 5,
      heldStep: 37,
      heldStepNotes: [40],
      stepWasHeld: true,
      stepEditNudge: 12,
      stepEditVel: 88,
      drumLaneSteps: [
        drumSteps,
        Array.from({ length: 32 }, () => Array(64).fill("0")),
        Array.from({ length: 32 }, () => Array(64).fill("0")),
      ],
    });

    expect(handleTrackViewStepRelease(S, deps(c), 5)).toBe(true);

    expect(S.drumLaneSteps[0][4][37]).toBe("0");
    expect(S.pendingDrumLaneResync).toBe(3);
    expect(S.pendingDrumLaneResyncTrack).toBe(0);
    expect(S.pendingDrumLaneResyncLane).toBe(4);
    expect(c.log).toEqual([
      ["setParam", "t0_l4_step_37_reassign", "38"],
      ["redraw"],
    ]);
  });

  test("drum hold release confirms velocity when not cleared or reassigned", () => {
    const c = calls();
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      heldStepBtn: 5,
      heldStep: 37,
      heldStepNotes: [40],
      stepWasHeld: true,
      stepEditNudge: 0,
      stepEditVel: 88,
    });

    expect(handleTrackViewStepRelease(S, deps(c), 5)).toBe(true);

    expect(c.log).toEqual([
      ["setParam", "t0_l4_step_37_vel", "88"],
      ["redraw"],
    ]);
  });

  test("melodic tap release assigns an empty held step from last played note", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      heldStepBtn: 5,
      heldStep: 53,
      stepWasEmpty: true,
      lastPlayedNote: 64,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 200, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepRelease(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.clipSteps[2][1][53]).toBe(1);
    expect(S.clipNonEmpty[2][1]).toBe(true);
    expect(S.heldStep).toBe(-1);
    expect(c.log).toEqual([
      ["stepEntryVelocity", 2, -1, false],
      ["setParam", "t2_c1_step_53_toggle", "64 96"],
      ["refreshSeqNotes", 2, 1, 53],
      ["redraw"],
    ]);
  });

  test("melodic tap release without a last played note flashes no-note warning", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      heldStepBtn: 5,
      heldStep: 53,
      stepWasEmpty: true,
      lastPlayedNote: -1,
      tickCount: 500,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 200, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepRelease(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.noNoteFlashEndTick).toBe(532);
    expect(S.screenDirty).toBe(true);
    expect(S.clipSteps[2][1][53]).toBe(0);
    expect(c.log).toEqual([["redraw"]]);
  });

  test("melodic tap release clears an occupied held step", () => {
    const c = calls();
    const clipSteps = [
      [Array(64).fill(0)],
      [Array(64).fill(0)],
      [Array(64).fill(0), Array(64).fill(0)],
    ];
    clipSteps[2][1][53] = 1;
    const S = state({
      copyHeld: false,
      heldStepBtn: 5,
      heldStep: 53,
      stepWasEmpty: false,
      clipSteps,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 200, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepRelease(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(c.log).toEqual([
      ["clearStep", 2, 1, 53],
      ["refreshSeqNotes", 2, 1, 53],
      ["redraw"],
    ]);
  });

  test("melodic hold release reassigns nudged notes and schedules a step reread", () => {
    const c = calls();
    const clipSteps = [
      [Array(64).fill(0)],
      [Array(64).fill(0)],
      [Array(64).fill(0), Array(64).fill(0)],
    ];
    clipSteps[2][1][53] = 1;
    const S = state({
      copyHeld: false,
      heldStepBtn: 5,
      heldStep: 53,
      heldStepNotes: [60],
      stepWasHeld: true,
      stepEditNudge: -13,
      clipSteps,
    });

    expect(handleTrackViewStepRelease(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.clipSteps[2][1][53]).toBe(0);
    expect(S.pendingStepsReread).toBe(2);
    expect(S.pendingStepsRereadTrack).toBe(2);
    expect(S.pendingStepsRereadClip).toBe(1);
    expect(c.log).toEqual([
      ["setParam", "t2_c1_step_53_reassign", "52"],
      ["redraw"],
    ]);
  });

  test("melodic CC bank release exits step edit without toggling or rereading notes", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      activeBank: 6,
      ccStepEditActive: true,
      heldStepBtn: 5,
      heldStep: 53,
      heldStepNotes: [60],
      stepWasEmpty: true,
      stepWasHeld: true,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 200, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepRelease(S, deps(c, { effectiveClip: () => 1 }), 5)).toBe(true);

    expect(S.ccStepEditActive).toBe(true);
    expect(S.heldStep).toBe(-1);
    expect(S.pendingStepsReread).toBe(0);
    expect(c.log).toEqual([["redraw"]]);
  });

  test("hold threshold ignores steps that have not reached the hold window", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      tickCount: 118,
      heldStepBtn: 5,
      heldStep: 53,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 100, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepHoldThreshold(S, deps(c))).toBe(false);

    expect(S.stepBtnPressedTick[5]).toBe(100);
    expect(S.stepWasHeld).toBe(false);
    expect(c.log).toEqual([]);
  });

  test("CC bank hold threshold seeds point, computed, and resting values", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      activeBank: 6,
      tickCount: 119,
      heldStepBtn: 5,
      heldStep: 53,
      stepWasEmpty: true,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 100, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepHoldThreshold(S, deps(c, {
      effectiveClip: () => 1,
      getParam: (key: string) => {
        c.log.push(["getParam", key]);
        return "64 -1 0 -1 127 -1 -1 -1 10 11 12 200 -1 15 16 17";
      },
    }))).toBe(true);

    expect(S.stepBtnPressedTick[5]).toBe(-1);
    expect(S.stepWasHeld).toBe(true);
    expect(S.ccStepEditSet).toEqual([true, false, true, false, true, false, false, false]);
    expect(S.ccStepEditComputed).toEqual([10, 11, 12, -1, -1, 15, 16, 17]);
    expect(S.ccStepEditVal).toEqual([64, 0, 0, 0, 127, 0, 40, 0]);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["getParam", "t2_c1_ccstepinfo_53"],
    ]);
  });

  test("drum empty-step hold threshold auto-assigns and reads back edit values", () => {
    const c = calls();
    const values = new Map([
      ["t0_l4_step_37_vel", "75"],
      ["t0_l4_step_37_gate", "18"],
      ["t0_l4_step_37_nudge", "-4"],
      ["t0_l4_step_37_iter", "3"],
      ["t0_l4_step_37_rand", "6"],
      ["t0_l4_step_37_ratch", "2"],
    ]);
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      tickCount: 119,
      heldStepBtn: 5,
      heldStep: 37,
      stepWasEmpty: true,
      stepEditVel: 96,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 100, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepHoldThreshold(S, deps(c, {
      getParam: (key: string) => {
        c.log.push(["getParam", key]);
        return values.get(key) ?? null;
      },
    }))).toBe(true);

    expect(S.drumLaneSteps[0][4][37]).toBe("1");
    expect(S.drumLaneHasNotes[0][4]).toBe(true);
    expect(S.heldStepNotes).toEqual([40]);
    expect(S.stepEditVel).toBe(75);
    expect(S.stepEditGate).toBe(18);
    expect(S.stepEditNudge).toBe(-4);
    expect(S.stepEditIter).toBe(3);
    expect(S.stepEditRand).toBe(6);
    expect(S.stepEditRatch).toBe(2);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["setParam", "t0_l4_step_37_toggle", "96"],
      ["getParam", "t0_l4_step_37_vel"],
      ["getParam", "t0_l4_step_37_gate"],
      ["getParam", "t0_l4_step_37_nudge"],
      ["getParam", "t0_l4_step_37_iter"],
      ["getParam", "t0_l4_step_37_rand"],
      ["getParam", "t0_l4_step_37_ratch"],
    ]);
  });

  test("drum occupied-step hold threshold only closes tap window and marks dirty", () => {
    const c = calls();
    const S = state({
      activeTrack: 0,
      copyHeld: false,
      tickCount: 119,
      heldStepBtn: 5,
      heldStep: 37,
      heldStepNotes: [40],
      stepWasEmpty: false,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 100, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepHoldThreshold(S, deps(c))).toBe(true);

    expect(S.stepBtnPressedTick[5]).toBe(-1);
    expect(S.stepWasHeld).toBe(true);
    expect(S.heldStepNotes).toEqual([40]);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([]);
  });

  test("melodic non-empty hold threshold reads notes and edit values", () => {
    const c = calls();
    const values = new Map([
      ["t2_c1_step_53_notes", "60 64 128 -1"],
      ["t2_c1_step_53_vel", "82"],
      ["t2_c1_step_53_gate", "48"],
      ["t2_c1_step_53_nudge", "7"],
      ["t2_c1_step_53_iter", "1"],
      ["t2_c1_step_53_rand", "4"],
      ["t2_c1_step_53_ratch", "2"],
    ]);
    const S = state({
      copyHeld: false,
      tickCount: 119,
      heldStepBtn: 5,
      heldStep: 53,
      stepWasEmpty: false,
      heldStepNotes: [],
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 100, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepHoldThreshold(S, deps(c, {
      effectiveClip: () => 1,
      getParam: (key: string) => {
        c.log.push(["getParam", key]);
        return values.get(key) ?? null;
      },
    }))).toBe(true);

    expect(S.heldStepNotes).toEqual([60, 64]);
    expect(S.stepEditVel).toBe(82);
    expect(S.stepEditGate).toBe(48);
    expect(S.stepEditNudge).toBe(7);
    expect(S.stepEditIter).toBe(1);
    expect(S.stepEditRand).toBe(4);
    expect(S.stepEditRatch).toBe(2);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["getParam", "t2_c1_step_53_notes"],
      ["getParam", "t2_c1_step_53_vel"],
      ["getParam", "t2_c1_step_53_gate"],
      ["getParam", "t2_c1_step_53_nudge"],
      ["getParam", "t2_c1_step_53_iter"],
      ["getParam", "t2_c1_step_53_rand"],
      ["getParam", "t2_c1_step_53_ratch"],
    ]);
  });

  test("melodic empty-step hold threshold auto-assigns last played note", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      tickCount: 119,
      heldStepBtn: 5,
      heldStep: 53,
      stepWasEmpty: true,
      heldStepNotes: [],
      lastPlayedNote: 67,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 100, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepHoldThreshold(S, deps(c, { effectiveClip: () => 1 }))).toBe(true);

    expect(S.clipSteps[2][1][53]).toBe(1);
    expect(S.clipNonEmpty[2][1]).toBe(true);
    expect(S.heldStepNotes).toEqual([67]);
    expect(S.stepEditVel).toBe(96);
    expect(S.stepWasEmpty).toBe(false);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["stepEntryVelocity", 2, -1, false],
      ["setParam", "t2_c1_step_53_toggle", "67 96"],
      ["refreshSeqNotes", 2, 1, 53],
    ]);
  });

  test("melodic empty-step hold threshold without last played note flashes no-note warning", () => {
    const c = calls();
    const S = state({
      copyHeld: false,
      tickCount: 119,
      heldStepBtn: 5,
      heldStep: 53,
      stepWasEmpty: true,
      heldStepNotes: [],
      lastPlayedNote: -1,
      stepBtnPressedTick: [-1, -1, -1, -1, -1, 100, ...Array(10).fill(-1)],
    });

    expect(handleTrackViewStepHoldThreshold(S, deps(c, { effectiveClip: () => 1 }))).toBe(true);

    expect(S.noNoteFlashEndTick).toBe(151);
    expect(S.screenDirty).toBe(true);
    expect(S.clipSteps[2][1][53]).toBe(0);
    expect(c.log).toEqual([]);
  });
});
