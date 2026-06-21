import { describe, expect, test } from "vitest";
import {
  drainNextDspOperation,
  enqueueDspOperation,
  enqueuePriorityDspOperation,
  holdDspOperationDrain,
} from "@overture-ui/sync/ui_dsp_operation_queue.mjs";

function calls() {
  const log: Array<[string, ...unknown[]]> = [];
  return {
    log,
    fn(name: string) {
      return (...args: unknown[]) => log.push([name, ...args]);
    },
  };
}

function state(overrides: Record<string, unknown> = {}) {
  return {
    clearDrainHold: 0,
    pendingDefaultSetParams: [] as Array<{ key: string; val: string }>,
    pendingSetLoad: false,
    pendingDspSync: 0,
    ...overrides,
  };
}

describe("DSP operation compatibility queue", () => {
  test("uses pendingDefaultSetParams backing storage and preserves push/unshift order", () => {
    const S = state();

    enqueueDspOperation(S, { key: "older", val: "1" });
    enqueuePriorityDspOperation(S, { key: "priority", val: "2" });
    enqueueDspOperation(S, { key: "newer", val: "3" });

    expect(S.pendingDefaultSetParams).toEqual([
      { key: "priority", val: "2" },
      { key: "older", val: "1" },
      { key: "newer", val: "3" },
    ]);
  });

  test("drains one operation per call after hold clears", () => {
    const c = calls();
    const S = state({
      pendingDefaultSetParams: [
        { key: "first", val: "1" },
        { key: "second", val: "2" },
      ],
    });
    const deps = { host_module_set_param: c.fn("set") };

    holdDspOperationDrain(S, 1);
    drainNextDspOperation(S, deps);
    expect(S.clearDrainHold).toBe(0);
    expect(c.log).toEqual([]);
    expect(S.pendingDefaultSetParams.map((p) => p.key)).toEqual(["first", "second"]);

    drainNextDspOperation(S, deps);
    expect(c.log).toEqual([["set", "first", "1"]]);
    expect(S.pendingDefaultSetParams.map((p) => p.key)).toEqual(["second"]);

    drainNextDspOperation(S, deps);
    expect(c.log).toEqual([
      ["set", "first", "1"],
      ["set", "second", "2"],
    ]);
    expect(S.pendingDefaultSetParams).toEqual([]);
  });

  test("suppresses drain during set load, DSP sync, and missing host write", () => {
    const c = calls();
    const S = state({
      pendingDefaultSetParams: [{ key: "held", val: "1" }],
    });
    const deps = { host_module_set_param: c.fn("set") };

    S.pendingSetLoad = true;
    drainNextDspOperation(S, deps);
    expect(S.pendingDefaultSetParams).toEqual([{ key: "held", val: "1" }]);

    S.pendingSetLoad = false;
    S.pendingDspSync = 2;
    drainNextDspOperation(S, deps);
    expect(S.pendingDefaultSetParams).toEqual([{ key: "held", val: "1" }]);

    S.pendingDspSync = 0;
    drainNextDspOperation(S, {});
    expect(S.pendingDefaultSetParams).toEqual([{ key: "held", val: "1" }]);
    expect(c.log).toEqual([]);

    drainNextDspOperation(S, deps);
    expect(S.pendingDefaultSetParams).toEqual([]);
    expect(c.log).toEqual([["set", "held", "1"]]);
  });
});
