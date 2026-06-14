import { describe, expect, test } from "vitest";
import {
  handleDrumRepeatGatePad,
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
});
