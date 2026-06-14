import { describe, expect, test } from "vitest";
import {
  runDefaultSetParamDrain,
  runDeferredContentResyncTasks,
  runDeferredDrumNoteOffDrain,
  runEndOfTickPersistenceTasks,
  runExternalRouteQueueDrain,
  runLiveNoteDrain,
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
  test("live-note drain waits past step operations and preserves collision ordering", () => {
    const c = calls();
    const pendingLiveNotes = [
      [
        { isOff: false, pitch: 60, vel: 100 },
        { isOff: true, pitch: 60 },
        { isOff: false, pitch: 64, vel: 90 },
        { isOff: true, pitch: 67 },
      ],
      [],
    ];
    const S = { tickCount: 10, stepOpTick: 9 };
    const deps = {
      NUM_TRACKS: 2,
      host_module_set_param: c.fn("set"),
      pendingLiveNotes,
    };

    runLiveNoteDrain(S, deps);
    expect(pendingLiveNotes[0]).toHaveLength(4);
    expect(c.log).toEqual([]);

    S.tickCount = 11;
    runLiveNoteDrain(S, deps);

    expect(pendingLiveNotes[0]).toEqual([]);
    expect(c.log).toEqual([
      ["set", "t0_live_notes", "off 67 on 64 90 on 60 100 off 60"],
    ]);
  });

  test("deferred drum note-off drain flushes pitch queues through liveSendNote", () => {
    const c = calls();
    const pendingDrumNoteOffs = [[36, 37], [] as number[], [48]];

    runDeferredDrumNoteOffDrain({
      NUM_TRACKS: 3,
      pendingDrumNoteOffs,
      liveSendNote: c.fn("liveSendNote"),
    });

    expect(pendingDrumNoteOffs).toEqual([[], [], []]);
    expect(c.log).toEqual([
      ["liveSendNote", 0, 0x80, 36, 0],
      ["liveSendNote", 0, 0x80, 37, 0],
      ["liveSendNote", 2, 0x80, 48, 0],
    ]);
  });

  test("external route queue drain forwards valid queued MIDI messages unless async send is active", () => {
    const c = calls();
    const S = { extSendAsyncEnabled: true };
    const deps = {
      host_module_get_param: c.fn("get"),
      move_midi_external_send: c.fn("external"),
    };

    runExternalRouteQueueDrain(S, deps);
    expect(c.log).toEqual([]);

    S.extSendAsyncEnabled = false;
    runExternalRouteQueueDrain(S, {
      host_module_get_param: (key: string) =>
        key === "ext_queue" ? "144 60 100;invalid;128 60 0;176 7 96" : "",
      move_midi_external_send: c.fn("external"),
    });

    expect(c.log).toEqual([
      ["external", [9, 144, 60, 100]],
      ["external", [8, 128, 60, 0]],
      ["external", [11, 176, 7, 96]],
    ]);
  });

  test("default set-param drain honors hold, load/sync gates, host availability, and FIFO order", () => {
    const c = calls();
    const deps = { host_module_set_param: c.fn("set") };
    const S = {
      clearDrainHold: 2,
      pendingDefaultSetParams: [
        { key: "first", val: "1" },
        { key: "second", val: "2" },
      ],
      pendingSetLoad: false,
      pendingDspSync: 0,
    };

    runDefaultSetParamDrain(S, deps);
    expect(S.clearDrainHold).toBe(1);
    expect(S.pendingDefaultSetParams).toEqual([
      { key: "first", val: "1" },
      { key: "second", val: "2" },
    ]);
    expect(c.log).toEqual([]);

    S.clearDrainHold = 0;
    S.pendingSetLoad = true;
    runDefaultSetParamDrain(S, deps);
    expect(S.pendingDefaultSetParams.map((p: { key: string }) => p.key)).toEqual(["first", "second"]);
    expect(c.log).toEqual([]);

    S.pendingSetLoad = false;
    S.pendingDspSync = 3;
    runDefaultSetParamDrain(S, deps);
    expect(S.pendingDefaultSetParams.map((p: { key: string }) => p.key)).toEqual(["first", "second"]);
    expect(c.log).toEqual([]);

    S.pendingDspSync = 0;
    runDefaultSetParamDrain(S, {});
    expect(S.pendingDefaultSetParams.map((p: { key: string }) => p.key)).toEqual(["first", "second"]);
    expect(c.log).toEqual([]);

    runDefaultSetParamDrain(S, deps);
    expect(S.pendingDefaultSetParams.map((p: { key: string }) => p.key)).toEqual(["second"]);
    expect(c.log).toEqual([["set", "first", "1"]]);

    runDefaultSetParamDrain(S, deps);
    expect(S.pendingDefaultSetParams).toEqual([]);
    expect(c.log).toEqual([
      ["set", "first", "1"],
      ["set", "second", "2"],
    ]);
  });

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
