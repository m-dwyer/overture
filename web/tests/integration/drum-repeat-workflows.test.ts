import { describe, expect, test } from "vitest";
import {
  handleDrumRepeatGatePad,
  handleDrumRepeat2LanePadPress,
  handleDrumRepeat2LanePadRelease,
  handleDrumRepeat2RightGridPadRelease,
} from "@tool-ui/ui_drum_repeat_workflows.mjs";

function calls() {
  const log: Array<[string, ...unknown[]]> = [];
  return {
    log,
    fn(name: string) {
      return (...args: unknown[]) => log.push([name, ...args]);
    },
  };
}

function baseState() {
  return {
    deleteHeld: false,
    loopHeld: false,
    drumRepeatGate: [[0b0010_1101]],
    drumRepeatGateLen: [[6]],
    drumRepeatVelScale: [[[90, 91, 92, 93, 94, 95, 96, 97]]],
    drumRepeatNudge: [[[1, 2, 3, 4, 5, 6, 7, 8]]],
  };
}

function rpt2State() {
  return {
    loopHeld: false,
    dspInboundEnabled: false,
    rpt2LoopPadUsed: false,
    drumRepeat2HeldLanes: [new Set<number>()],
    drumRepeat2LatchedLanes: [new Set<number>()],
  };
}

describe("drum repeat workflows", () => {
  test("tap gate pad toggles the repeat gate bit and redraws", () => {
    const c = calls();
    const S = baseState();

    expect(handleDrumRepeatGatePad(S, {
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 0, 2)).toBe(true);

    expect(S.drumRepeatGate[0][0]).toBe(0b0010_1001);
    expect(S.drumRepeatGateLen[0][0]).toBe(6);
    expect(c.log).toEqual([
      ["set", "t0_l0_repeat_gate_toggle", "2"],
      ["redraw"],
    ]);
  });

  test("Loop+gate pad sets the gate cycle length and fill mask", () => {
    const c = calls();
    const S = baseState();
    S.loopHeld = true;

    expect(handleDrumRepeatGatePad(S, {
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 0, 4)).toBe(true);

    expect(S.drumRepeatGate[0][0]).toBe(0b0001_1111);
    expect(S.drumRepeatGateLen[0][0]).toBe(5);
    expect(c.log).toEqual([
      ["set", "t0_l0_repeat_gate_and_len", "31 5"],
      ["redraw"],
    ]);
  });

  test("Delete+gate pad resets repeat defaults for that step", () => {
    const c = calls();
    const S = baseState();
    S.deleteHeld = true;

    expect(handleDrumRepeatGatePad(S, {
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 0, 5)).toBe(true);

    expect(S.drumRepeatVelScale[0][0][5]).toBe(100);
    expect(S.drumRepeatNudge[0][0][5]).toBe(0);
    expect(S.drumRepeatGate[0][0]).toBe(0b0010_1101);
    expect(c.log).toEqual([
      ["set", "t0_l0_repeat_defaults", "5"],
      ["redraw"],
    ]);
  });

  test("gate pad ignores invalid step targets", () => {
    const c = calls();
    const S = baseState();

    expect(handleDrumRepeatGatePad(S, {
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 0, -1)).toBe(false);
    expect(handleDrumRepeatGatePad(S, {
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 0, 8)).toBe(false);

    expect(S.drumRepeatGate[0][0]).toBe(0b0010_1101);
    expect(c.log).toEqual([]);
  });

  test("Rpt2 lane pad selects and engages an unlatched lane on stock Schwung", () => {
    const c = calls();
    const S = rpt2State();
    const padPitch = new Array(32).fill(64);

    expect(handleDrumRepeat2LanePadPress(S, {
      DRUM_LANES: 32,
      setActiveDrumLane: c.fn("setActive"),
      syncDrumLaneSteps: c.fn("syncSteps"),
      refreshDrumLaneBankParams: c.fn("refreshBank"),
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
      padPitch,
    }, 0, 5, 9, 101)).toBe(true);

    expect(S.drumRepeat2HeldLanes[0].has(5)).toBe(true);
    expect(S.drumRepeat2LatchedLanes[0].has(5)).toBe(false);
    expect(S.rpt2LoopPadUsed).toBe(false);
    expect(padPitch[9]).toBe(-1);
    expect(c.log).toEqual([
      ["setActive", 0, 5],
      ["syncSteps", 0, 5],
      ["refreshBank", 0, 5],
      ["set", "t0_drum_repeat2_lane_on", "5 101"],
      ["redraw"],
    ]);
  });

  test("Rpt2 Loop+lane pad latches the lane and pushes latch-held after lane-on", () => {
    const c = calls();
    const S = rpt2State();
    S.loopHeld = true;
    const padPitch = new Array(32).fill(64);

    expect(handleDrumRepeat2LanePadPress(S, {
      DRUM_LANES: 32,
      setActiveDrumLane: c.fn("setActive"),
      syncDrumLaneSteps: c.fn("syncSteps"),
      refreshDrumLaneBankParams: c.fn("refreshBank"),
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
      padPitch,
    }, 0, 6, 10, 88)).toBe(true);

    expect(S.drumRepeat2HeldLanes[0].has(6)).toBe(true);
    expect(S.drumRepeat2LatchedLanes[0].has(6)).toBe(true);
    expect(S.rpt2LoopPadUsed).toBe(true);
    expect(c.log).toEqual([
      ["setActive", 0, 6],
      ["syncSteps", 0, 6],
      ["refreshBank", 0, 6],
      ["set", "t0_drum_repeat2_lane_on", "6 88"],
      ["set", "t0_drum_repeat2_latch_held", "1"],
      ["redraw"],
    ]);
  });

  test("Rpt2 Loop+lane pad on patched Schwung skips lane-on but keeps latch-held", () => {
    const c = calls();
    const S = rpt2State();
    S.loopHeld = true;
    S.dspInboundEnabled = true;
    const padPitch = new Array(32).fill(64);

    expect(handleDrumRepeat2LanePadPress(S, {
      DRUM_LANES: 32,
      setActiveDrumLane: c.fn("setActive"),
      syncDrumLaneSteps: c.fn("syncSteps"),
      refreshDrumLaneBankParams: c.fn("refreshBank"),
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
      padPitch,
    }, 0, 7, 11, 77)).toBe(true);

    expect(S.drumRepeat2HeldLanes[0].has(7)).toBe(true);
    expect(S.drumRepeat2LatchedLanes[0].has(7)).toBe(true);
    expect(c.log).toEqual([
      ["setActive", 0, 7],
      ["syncSteps", 0, 7],
      ["refreshBank", 0, 7],
      ["set", "t0_drum_repeat2_latch_held", "1"],
      ["redraw"],
    ]);
  });

  test("Rpt2 lane pad unlatches an existing lane and gates lane-off on patched Schwung", () => {
    const c = calls();
    const S = rpt2State();
    S.loopHeld = true;
    S.drumRepeat2LatchedLanes[0].add(8);
    const padPitch = new Array(32).fill(64);

    expect(handleDrumRepeat2LanePadPress(S, {
      DRUM_LANES: 32,
      setActiveDrumLane: c.fn("setActive"),
      syncDrumLaneSteps: c.fn("syncSteps"),
      refreshDrumLaneBankParams: c.fn("refreshBank"),
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
      padPitch,
    }, 0, 8, 12, 90)).toBe(true);

    expect(S.drumRepeat2LatchedLanes[0].has(8)).toBe(false);
    expect(S.rpt2LoopPadUsed).toBe(true);
    expect(padPitch[12]).toBe(64);
    expect(c.log).toEqual([
      ["setActive", 0, 8],
      ["syncSteps", 0, 8],
      ["refreshBank", 0, 8],
      ["set", "t0_drum_repeat2_lane_off", "8"],
      ["redraw"],
    ]);

    c.log.length = 0;
    S.drumRepeat2LatchedLanes[0].add(8);
    S.dspInboundEnabled = true;
    expect(handleDrumRepeat2LanePadPress(S, {
      DRUM_LANES: 32,
      setActiveDrumLane: c.fn("setActive"),
      syncDrumLaneSteps: c.fn("syncSteps"),
      refreshDrumLaneBankParams: c.fn("refreshBank"),
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
      padPitch,
    }, 0, 8, 12, 90)).toBe(true);

    expect(c.log).toEqual([
      ["setActive", 0, 8],
      ["syncSteps", 0, 8],
      ["refreshBank", 0, 8],
      ["redraw"],
    ]);
  });

  test("Rpt2 lane pad ignores invalid lane targets", () => {
    const c = calls();
    const S = rpt2State();
    const padPitch = new Array(32).fill(64);

    expect(handleDrumRepeat2LanePadPress(S, {
      DRUM_LANES: 32,
      setActiveDrumLane: c.fn("setActive"),
      syncDrumLaneSteps: c.fn("syncSteps"),
      refreshDrumLaneBankParams: c.fn("refreshBank"),
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
      padPitch,
    }, 0, 32, 9, 101)).toBe(false);

    expect(S.drumRepeat2HeldLanes[0].size).toBe(0);
    expect(c.log).toEqual([]);
  });

  test("Rpt2 lane release stops an unlatched held lane", () => {
    const c = calls();
    const S = rpt2State();
    S.drumRepeat2HeldLanes[0].add(5);
    S.screenDirty = false;

    expect(handleDrumRepeat2LanePadRelease(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
    }, 0, 5)).toBe(true);

    expect(S.drumRepeat2HeldLanes[0].has(5)).toBe(false);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat2_lane_off", "5"],
    ]);
  });

  test("Rpt2 lane release keeps a latched held lane running", () => {
    const c = calls();
    const S = rpt2State();
    S.drumRepeat2HeldLanes[0].add(6);
    S.drumRepeat2LatchedLanes[0].add(6);
    S.screenDirty = false;

    expect(handleDrumRepeat2LanePadRelease(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
    }, 0, 6)).toBe(true);

    expect(S.drumRepeat2HeldLanes[0].has(6)).toBe(false);
    expect(S.drumRepeat2LatchedLanes[0].has(6)).toBe(true);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([]);
  });

  test("Rpt2 lane release ignores invalid or unheld lanes", () => {
    const c = calls();
    const S = rpt2State();
    S.drumRepeat2HeldLanes[0].add(7);
    S.screenDirty = false;

    expect(handleDrumRepeat2LanePadRelease(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
    }, 0, 32)).toBe(false);
    expect(handleDrumRepeat2LanePadRelease(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
    }, 0, 8)).toBe(false);

    expect(S.drumRepeat2HeldLanes[0].has(7)).toBe(true);
    expect(S.screenDirty).toBe(false);
    expect(c.log).toEqual([]);
  });

  test("Rpt2 right-grid release marks the screen dirty and swallows the pad release", () => {
    const S = { screenDirty: false };

    expect(handleDrumRepeat2RightGridPadRelease(S)).toBe(true);

    expect(S.screenDirty).toBe(true);
  });
});
