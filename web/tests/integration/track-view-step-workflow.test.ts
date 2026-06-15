import { describe, expect, test } from "vitest";
import {
  handleTrackViewCopyStepPress,
  handleTrackViewDeleteStepPress,
  handleTrackViewMuteStepPress,
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

function deps(c: ReturnType<typeof calls>) {
  return {
    clearStep: c.fn("clearStep"),
    copyStep: c.fn("copyStep"),
    effectiveClip: c.fn("effectiveClip"),
    invalidateLEDCache: c.fn("invalidate"),
    forceRedraw: c.fn("redraw"),
    padModeDrum: 1,
    setParam: c.fn("setParam"),
    showActionPopup: c.fn("popup"),
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
    activeBank: 0,
    trackPadMode: [1, 0, 0],
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
});
