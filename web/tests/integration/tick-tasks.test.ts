import { describe, expect, test } from "vitest";
import {
  runDeferredContentResyncTasks,
  runEndOfTickPersistenceTasks,
  runMoveCoRunTickTasks,
} from "@tool-ui/ui_tick_tasks.mjs";

function calls() {
  const log: Array<[string, ...unknown[]]> = [];
  return {
    log,
    fn(name: string) {
      return (...args: unknown[]) => log.push([name, ...args]);
    },
  };
}

describe("tick task drains", () => {
  test("Move co-run inject arms the same track-button press queue and drains with defensive Shift-off", () => {
    const c = calls();
    const S = {
      pendingMoveCoRunInject: 1,
      moveCoRunTrack: 1,
      trackChannel: [1, 2, 3, 4],
      moveCoRunPressQueue: null,
      moveCoRunPressGap: 0,
    };

    runMoveCoRunTickTasks(S, { move_midi_inject_to_move: c.fn("inject") });

    expect(S.pendingMoveCoRunInject).toBe(0);
    expect(c.log).toEqual([
      ["inject", [0x0B, 0xB0, 49, 0]],
      ["inject", [0x0B, 0xB0, 43, 127]],
      ["inject", [0x0B, 0xB0, 43, 0]],
    ]);
    expect(S.moveCoRunPressQueue).toEqual([42, 43, 42]);
    expect(S.moveCoRunPressGap).toBe(5);

    runMoveCoRunTickTasks(S, { move_midi_inject_to_move: c.fn("inject") });
    expect(S.moveCoRunPressGap).toBe(4);
    expect(c.log).toHaveLength(3);
  });

  test("content resync drains decrement first and fire only on the zero tick", () => {
    const c = calls();
    const S = {
      pendingDrumResync: 2,
      pendingDrumResyncTrack: 3,
      pendingDrumLaneResync: 1,
      pendingDrumLaneResyncTrack: 4,
      pendingDrumLaneResyncLane: 7,
      pendingStepsReread: 1,
      pendingStepsRereadTrack: 0,
      pendingStepsRereadClip: 2,
      pendingSceneBakeResync: 1,
      pendingSceneBakeClip: 5,
      activeDrumLane: [0, 1, 2, 3, 4, 5, 6, 7],
      trackPadMode: [0, 1, 0, 1, 0, 1, 0, 1],
      trackActiveClip: [5, 5, 4, 5, 5, 1, 5, 5],
      clipSteps: Array.from({ length: 8 }, () => Array.from({ length: 16 }, () => new Array(16).fill(0))),
      clipNonEmpty: Array.from({ length: 8 }, () => new Array(16).fill(false)),
      clipLength: Array.from({ length: 8 }, () => new Array(16).fill(16)),
      clipTPS: Array.from({ length: 8 }, () => new Array(16).fill(24)),
    };
    const params = new Map<string, string>([
      ["t0_c2_steps", "1000000000000000"],
      ["t0_c2_length", "32"],
      ["t0_c2_tps", "12"],
      ["t0_c5_steps", "2000000000000000"],
      ["t0_c5_length", "48"],
      ["t0_c5_tps", "6"],
      ["t2_c5_steps", "1000000000000000"],
      ["t2_c5_length", "64"],
      ["t2_c5_tps", "24"],
      ["t4_c5_steps", "0000000000000000"],
      ["t4_c5_length", "16"],
      ["t4_c5_tps", "99"],
      ["t6_c5_steps", "1000000000000000"],
      ["t6_c5_length", "8"],
      ["t6_c5_tps", "12"],
    ]);

    const deps = {
      NUM_TRACKS: 8,
      NUM_STEPS: 16,
      PAD_MODE_DRUM: 1,
      TPS_VALUES: [6, 12, 24],
      host_module_get_param: (key: string) => params.get(key) ?? null,
      syncDrumClipContent: c.fn("syncDrumClipContent"),
      syncDrumLanesMeta: c.fn("syncDrumLanesMeta"),
      syncDrumLaneSteps: c.fn("syncDrumLaneSteps"),
      refreshDrumLaneBankParams: c.fn("refreshDrumLaneBankParams"),
      refreshPerClipBankParams: c.fn("refreshPerClipBankParams"),
      clipHasContent: (t: number, clip: number) => S.clipSteps[t][clip].some((v: number) => v !== 0),
      forceRedraw: c.fn("forceRedraw"),
    };

    runDeferredContentResyncTasks(S, deps);

    expect(S.pendingDrumResync).toBe(1);
    expect(c.log).toEqual([
      ["syncDrumLaneSteps", 4, 7],
      ["refreshDrumLaneBankParams", 4, 7],
      ["forceRedraw"],
      ["forceRedraw"],
      ["refreshPerClipBankParams", 0],
      ["syncDrumClipContent", 1],
      ["syncDrumLanesMeta", 1],
      ["syncDrumLaneSteps", 1, 1],
      ["syncDrumClipContent", 3],
      ["syncDrumLanesMeta", 3],
      ["syncDrumLaneSteps", 3, 3],
      ["refreshPerClipBankParams", 4],
      ["refreshPerClipBankParams", 6],
      ["syncDrumClipContent", 7],
      ["syncDrumLanesMeta", 7],
      ["syncDrumLaneSteps", 7, 7],
      ["forceRedraw"],
    ]);
    expect(S.clipSteps[0][2][0]).toBe(1);
    expect(S.clipLength[0][2]).toBe(32);
    expect(S.clipTPS[4][5]).toBe(24);
  });

  test("end-of-tick persistence preserves save, exit, hide, and snapshot priority", () => {
    const c = calls();
    const baseDeps = {
      updateNameIndex: c.fn("updateNameIndex"),
      host_module_set_param: c.fn("set"),
      removeFlagsWrap: c.fn("removeFlagsWrap"),
      invalidateLEDCache: c.fn("invalidateLEDCache"),
      clearAllLEDs: c.fn("clearAllLEDs"),
      setButtonLED: c.fn("setButtonLED"),
      host_exit_module: c.fn("exit"),
      host_hide_module: c.fn("hide"),
      commitSnapshot: c.fn("commitSnapshot"),
      LED_OFF: 0,
    };

    const saveState = { pendingSuspendSave: true, pendingExitAfterSave: true, pendingHideAfterSave: true, pendingSnapshotCopy: { id: 2, label: "A" } };
    runEndOfTickPersistenceTasks(saveState, baseDeps);
    expect(saveState.pendingSuspendSave).toBe(false);
    expect(saveState.pendingExitAfterSave).toBe(true);
    expect(c.log).toEqual([["updateNameIndex"], ["set", "save", "1"]]);

    c.log.length = 0;
    runEndOfTickPersistenceTasks(saveState, baseDeps);
    expect(saveState.pendingExitAfterSave).toBe(false);
    expect(c.log.at(-1)).toEqual(["exit"]);
    expect(c.log.filter(([name]) => name === "setButtonLED")).toHaveLength(4);

    c.log.length = 0;
    const hideState = { pendingHideAfterSave: true };
    runEndOfTickPersistenceTasks(hideState, baseDeps);
    expect(hideState.pendingHideAfterSave).toBe(false);
    expect(c.log.at(-1)).toEqual(["hide"]);

    c.log.length = 0;
    const snapState = { currentSetUuid: "uuid", pendingSnapshotCopy: { id: 7, label: "B" } };
    runEndOfTickPersistenceTasks(snapState, baseDeps);
    expect(snapState.pendingSnapshotCopy).toBeNull();
    expect(c.log).toEqual([["commitSnapshot", "uuid", 7, "B"]]);
  });
});
