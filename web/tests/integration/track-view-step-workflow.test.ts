import { describe, expect, test } from "vitest";
import {
  handleTrackViewCopyStepPress,
  handleTrackViewDeleteStepPress,
  handleTrackViewMuteStepPress,
  handleTrackViewShiftStepPress,
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
    invalidateLEDCache: c.fn("invalidate"),
    forceRedraw: c.fn("redraw"),
    padModeDrum: 1,
    setParam: c.fn("setParam"),
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
    activeBank: 0,
    trackPadMode: [1, 0, 0],
    padLayoutChromatic: [false, false, false],
    trackVelOverride: [0, 0, 100],
    bankParams: Array.from({ length: 3 }, () =>
      Array.from({ length: 8 }, () => new Array(8).fill(0))
    ),
    lastTarpStyle: [2, 3, 4],
    drumLaneQnt: [64, 64, 64],
    clipTPS: [
      [24],
      [24],
      [24, 24],
    ],
    ccActiveLane: [0, 0, 1],
    ccLaneTps: [
      [[0]],
      [[0]],
      [[0], [0, 48, 0]],
    ],
    pendingCCBitsRefresh: -1,
    undoAvailable: false,
    redoAvailable: true,
    undoSeqArpSnapshot: { captured: true },
    activeDrumLane: [4, 0, 0],
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
});
