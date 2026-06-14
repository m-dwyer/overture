import { describe, expect, test } from "vitest";
import {
  handleDrumRepeatRatePadPress,
  handleDrumRepeatRatePadRelease,
  handleDrumRepeatGatePad,
  handleDrumRepeat2LanePadPress,
  handleDrumRepeat2LanePadRelease,
  handleDrumRepeat2RatePadPress,
  handleDrumRepeat2RightGridPadRelease,
  handleDrumRepeatPadAftertouch,
  handleDrumRepeat2LaneAftertouch,
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
    drumRepeat2RatePerLane: [[0, 1, 2, 3, 4, 5, 6, 7]],
    drumRepeat2HeldLanes: [new Set<number>()],
    drumRepeat2LatchedLanes: [new Set<number>()],
    screenDirty: false,
  };
}

function rpt1State() {
  return {
    loopHeld: false,
    dspInboundEnabled: false,
    drumRepeatHeldPad: [-1],
    drumRepeatHeldPadVel: [100],
    drumRepeatHeldPadsStack: [[] as Array<{ padIdx: number; rateIdx: number; vel: number }>],
    drumRepeatLatched: [false],
    screenDirty: false,
  };
}

describe("drum repeat workflows", () => {
  test("Rpt1 rate pad press stores the held pad and starts stock repeat", () => {
    const c = calls();
    const S = rpt1State();

    expect(handleDrumRepeatRatePadPress(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 5, 1, 12, 96)).toBe(true);

    expect(S.drumRepeatHeldPad[0]).toBe(5);
    expect(S.drumRepeatHeldPadVel[0]).toBe(96);
    expect(S.drumRepeatLatched[0]).toBe(false);
    expect(S.drumRepeatHeldPadsStack[0]).toEqual([]);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat_start", "12 1 96"],
      ["set", "t0_drum_repeat_latched", "0"],
    ]);
  });

  test("Rpt1 patched Schwung skips drum_repeat_start on press but writes latch state", () => {
    const c = calls();
    const S = rpt1State();
    S.dspInboundEnabled = true;

    expect(handleDrumRepeatRatePadPress(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 6, 2, 9, 80)).toBe(true);

    expect(S.drumRepeatHeldPad[0]).toBe(6);
    expect(S.drumRepeatHeldPadVel[0]).toBe(80);
    expect(S.drumRepeatLatched[0]).toBe(false);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat_latched", "0"],
    ]);
  });

  test("Rpt1 Loop-held rate press latches after starting repeat", () => {
    const c = calls();
    const S = rpt1State();
    S.loopHeld = true;

    expect(handleDrumRepeatRatePadPress(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 12, 4, 3, 101)).toBe(true);

    expect(S.drumRepeatHeldPad[0]).toBe(12);
    expect(S.drumRepeatHeldPadVel[0]).toBe(101);
    expect(S.drumRepeatLatched[0]).toBe(true);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat_start", "3 4 101"],
      ["set", "t0_drum_repeat_latched", "1"],
    ]);
  });

  test("Rpt1 pressing the same latched pad again unlatches and stops", () => {
    const c = calls();
    const S = rpt1State();
    S.drumRepeatHeldPad[0] = 5;
    S.drumRepeatHeldPadVel[0] = 91;
    S.drumRepeatHeldPadsStack[0].push({ padIdx: 4, rateIdx: 0, vel: 70 });
    S.drumRepeatLatched[0] = true;

    expect(handleDrumRepeatRatePadPress(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 5, 1, 2, 88)).toBe(true);

    expect(S.drumRepeatHeldPad[0]).toBe(-1);
    expect(S.drumRepeatHeldPadsStack[0]).toEqual([]);
    expect(S.drumRepeatLatched[0]).toBe(false);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat_stop", "1"],
    ]);
  });

  test("Rpt1 pressing another rate while one is held pushes the previous pad to the stack", () => {
    const c = calls();
    const S = rpt1State();
    S.drumRepeatHeldPad[0] = 4;
    S.drumRepeatHeldPadVel[0] = 77;

    expect(handleDrumRepeatRatePadPress(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 13, 5, 6, 110)).toBe(true);

    expect(S.drumRepeatHeldPad[0]).toBe(13);
    expect(S.drumRepeatHeldPadVel[0]).toBe(110);
    expect(S.drumRepeatHeldPadsStack[0]).toEqual([{ padIdx: 4, rateIdx: 0, vel: 77 }]);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat_start", "6 5 110"],
      ["set", "t0_drum_repeat_latched", "0"],
    ]);
  });

  test("Rpt1 releasing the active unlatched pad resumes the previous stacked rate", () => {
    const c = calls();
    const S = rpt1State();
    S.dspInboundEnabled = true;
    S.drumRepeatHeldPad[0] = 13;
    S.drumRepeatHeldPadVel[0] = 110;
    S.drumRepeatHeldPadsStack[0].push({ padIdx: 4, rateIdx: 0, vel: 77 });

    expect(handleDrumRepeatRatePadRelease(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 13, 6)).toBe(true);

    expect(S.drumRepeatHeldPad[0]).toBe(4);
    expect(S.drumRepeatHeldPadsStack[0]).toEqual([]);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat_start", "6 0 77"],
    ]);
  });

  test("Rpt1 releasing the active unlatched pad with no stack stops", () => {
    const c = calls();
    const S = rpt1State();
    S.drumRepeatHeldPad[0] = 5;

    expect(handleDrumRepeatRatePadRelease(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 5, 2)).toBe(true);

    expect(S.drumRepeatHeldPad[0]).toBe(-1);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat_stop", "1"],
    ]);
  });

  test("Rpt1 releasing a queued inactive pad removes it from the stack", () => {
    const c = calls();
    const S = rpt1State();
    S.drumRepeatHeldPad[0] = 13;
    S.drumRepeatHeldPadsStack[0].push(
      { padIdx: 4, rateIdx: 0, vel: 77 },
      { padIdx: 5, rateIdx: 1, vel: 88 },
    );

    expect(handleDrumRepeatRatePadRelease(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 4, 6)).toBe(true);

    expect(S.drumRepeatHeldPad[0]).toBe(13);
    expect(S.drumRepeatHeldPadsStack[0]).toEqual([{ padIdx: 5, rateIdx: 1, vel: 88 }]);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([]);
  });

  test("Rpt1 right-grid release always marks dirty and swallows inactive gate-pad release", () => {
    const c = calls();
    const S = rpt1State();

    expect(handleDrumRepeatRatePadRelease(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 22, 6)).toBe(true);

    expect(S.drumRepeatHeldPad[0]).toBe(-1);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([]);
  });

  test("Rpt1 aftertouch on the held rate pad updates velocity and sends pressure", () => {
    const c = calls();
    const S = rpt1State();
    S.drumRepeatHeldPad[0] = 13;
    S.drumRepeatHeldPadVel[0] = 90;

    expect(handleDrumRepeatPadAftertouch(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 13, 117)).toBe(true);

    expect(S.drumRepeatHeldPadVel[0]).toBe(117);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat_vel", "117"],
    ]);
  });

  test("Rpt1 aftertouch on another pad does nothing", () => {
    const c = calls();
    const S = rpt1State();
    S.drumRepeatHeldPad[0] = 13;
    S.drumRepeatHeldPadVel[0] = 90;

    expect(handleDrumRepeatPadAftertouch(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 12, 117)).toBe(false);

    expect(S.drumRepeatHeldPadVel[0]).toBe(90);
    expect(c.log).toEqual([]);
  });

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

  test("Rpt2 rate pad updates the active lane mirror and sends stock Schwung rate assignment", () => {
    const c = calls();
    const S = rpt2State();

    expect(handleDrumRepeat2RatePadPress(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 5, 6)).toBe(true);

    expect(S.drumRepeat2RatePerLane[0][5]).toBe(6);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([
      ["set", "t0_drum_repeat2_rate", "5 6"],
    ]);
  });

  test("Rpt2 rate pad skips stock rate assignment on patched Schwung but still marks dirty", () => {
    const c = calls();
    const S = rpt2State();
    S.dspInboundEnabled = true;

    expect(handleDrumRepeat2RatePadPress(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 4, 2)).toBe(true);

    expect(S.drumRepeat2RatePerLane[0][4]).toBe(2);
    expect(S.screenDirty).toBe(true);
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

  test("Rpt2 aftertouch on a held lane sends lane pressure", () => {
    const c = calls();
    const S = rpt2State();
    S.drumRepeat2HeldLanes[0].add(6);

    expect(handleDrumRepeat2LaneAftertouch(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 6, 104)).toBe(true);

    expect(c.log).toEqual([
      ["set", "t0_drum_repeat2_vel", "6 104"],
    ]);
  });

  test("Rpt2 aftertouch on an unheld lane does nothing", () => {
    const c = calls();
    const S = rpt2State();
    S.drumRepeat2HeldLanes[0].add(6);

    expect(handleDrumRepeat2LaneAftertouch(S, {
      host_module_set_param: c.fn("set"),
    }, 0, 7, 104)).toBe(false);

    expect(c.log).toEqual([]);
  });
});
