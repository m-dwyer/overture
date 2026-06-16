import { describe, expect, test } from "vitest";
import {
  runCcGradientPalette,
  runCcLiveValPoll,
  runDefaultSetParamDrain,
  runDeferredCcBitsRefresh,
  runDeferredContentResyncTasks,
  runDeferredDrumNoteOffDrain,
  runDeferredLaneEditReadbackTasks,
  runDspMirrorResyncTasks,
  runEndOfTickPersistenceTasks,
  runExternalRouteQueueDrain,
  runExtMidiRemapReapply,
  runGlobalMenuParamPreview,
  runLiveNoteDrain,
  runMetroNoteOffTask,
  runMoveCoRunTickTasks,
  runPadMapSelfHealTask,
  runPendingPadNoteMapRecompute,
  runPendingSetLoad,
  runPendingTrackConvert,
  runPendingUndoSyncTask,
  runRepeatRecordingLaneRefreshTask,
  runSchLabelFetch,
  runSessionViewEdgeTasks,
  runTransposePreviewSelfHeal,
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

function dspMirrorDeps(c: ReturnType<typeof calls>, instanceId = "new-instance") {
  return {
    host_module_get_param: (key: string) => {
      c.log.push(["get", key]);
      return key === "instance_id" ? instanceId : null;
    },
    host_module_set_param: c.fn("set"),
    pollDSP: c.fn("pollDSP"),
    syncClipsFromDsp: c.fn("syncClipsFromDsp"),
    syncMuteSoloFromDsp: c.fn("syncMuteSoloFromDsp"),
    restoreUiSidecar: c.fn("restoreUiSidecar"),
    computePadNoteMap: c.fn("computePadNoteMap"),
    invalidateLEDCache: c.fn("invalidateLEDCache"),
    forceRedraw: c.fn("forceRedraw"),
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

  test("metro note-off task injects once when the scheduled tick is reached", () => {
    const c = calls();
    const S = { metroNoteOffTick: 20, tickCount: 19 };
    const deps = { move_midi_inject_to_move: c.fn("inject") };

    runMetroNoteOffTask(S, deps);
    expect(S.metroNoteOffTick).toBe(20);
    expect(c.log).toEqual([]);

    S.tickCount = 20;
    runMetroNoteOffTask(S, deps);
    expect(S.metroNoteOffTick).toBe(-1);
    expect(c.log).toEqual([["inject", [0x09, 0x80, 108, 0]]]);

    S.tickCount = 21;
    runMetroNoteOffTask(S, deps);
    expect(c.log).toHaveLength(1);
  });

  test("padmap self-heal is inert unless DSP inbound pad handling is enabled", () => {
    const c = calls();
    const S = {
      dspInboundEnabled: false,
      tickCount: 10,
      lastPushedMuted: false,
      sessionView: false,
      padNoteMap: [60],
      trackPadMode: [0],
      trackOctave: [0],
      activeTrack: 0,
    };

    runPadMapSelfHealTask(S, {
      PAD_MODE_DRUM: 1,
      padDispatchMuted: () => true,
      host_module_get_param: c.fn("get"),
      computePadNoteMap: c.fn("compute"),
    });

    expect(c.log).toEqual([]);
  });

  test("padmap self-heal repushes immediately when JS mute state drifts from last push", () => {
    const c = calls();
    const S = {
      dspInboundEnabled: true,
      tickCount: 11,
      lastPushedMuted: false,
      sessionView: false,
      padNoteMap: [60],
      trackPadMode: [0],
      trackOctave: [0],
      activeTrack: 0,
    };

    runPadMapSelfHealTask(S, {
      PAD_MODE_DRUM: 1,
      padDispatchMuted: () => true,
      host_module_get_param: c.fn("get"),
      computePadNoteMap: c.fn("compute"),
    });

    expect(c.log).toEqual([["compute"]]);
  });

  test("padmap self-heal polls DSP every fifth tick and repushes on mute or pad-0 mismatch", () => {
    const c = calls();
    const S = {
      dspInboundEnabled: true,
      tickCount: 15,
      lastPushedMuted: false,
      sessionView: false,
      padNoteMap: [60],
      trackPadMode: [0],
      trackOctave: [1],
      activeTrack: 0,
    };

    runPadMapSelfHealTask(S, {
      PAD_MODE_DRUM: 1,
      padDispatchMuted: () => false,
      host_module_get_param: (key: string) =>
        key === "pad_dispatch_muted" ? "1" : key === "pad_note_map_0" ? "71" : null,
      computePadNoteMap: c.fn("compute"),
    });

    expect(c.log).toEqual([["compute"], ["compute"]]);

    c.log.length = 0;
    S.padNoteMap[0] = 0xff;
    runPadMapSelfHealTask(S, {
      PAD_MODE_DRUM: 1,
      padDispatchMuted: () => false,
      host_module_get_param: (key: string) =>
        key === "pad_dispatch_muted" ? "0" : key === "pad_note_map_0" ? "127" : null,
      computePadNoteMap: c.fn("compute"),
    });

    expect(c.log).toEqual([["compute"]]);
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

  test("DSP hot-reload resync is gated by cadence, host availability, and changed non-empty instance id", () => {
    const c = calls();
    const S = {
      tickCount: 99,
      lastDspInstanceId: "old-instance",
      pendingDspSync: 0,
      stateLoading: true,
      trackCurrentStep: [0, 31],
      trackCurrentPage: [9, 9],
    };

    runDspMirrorResyncTasks(S, dspMirrorDeps(c));
    expect(c.log).toEqual([]);
    expect(S.lastDspInstanceId).toBe("old-instance");

    S.tickCount = 100;
    runDspMirrorResyncTasks(S, { ...dspMirrorDeps(c), host_module_set_param: null });
    expect(c.log).toEqual([]);
    expect(S.lastDspInstanceId).toBe("old-instance");

    runDspMirrorResyncTasks(S, dspMirrorDeps(c, "old-instance"));
    expect(c.log).toEqual([["get", "instance_id"]]);
    expect(S.lastDspInstanceId).toBe("old-instance");

    c.log.length = 0;
    S.lastDspInstanceId = "";
    runDspMirrorResyncTasks(S, dspMirrorDeps(c, "first-instance"));
    expect(c.log).toEqual([["get", "instance_id"]]);
    expect(S.lastDspInstanceId).toBe("first-instance");
  });

  test("DSP hot-reload refreshes mirrors in order without sidecar restore or clearing state loading", () => {
    const c = calls();
    const S = {
      tickCount: 200,
      lastDspInstanceId: "old-instance",
      pendingDspSync: 0,
      stateLoading: true,
      trackCurrentStep: [-1, 0, 16, 31],
      trackCurrentPage: [7, 7, 7, 7],
    };

    runDspMirrorResyncTasks(S, dspMirrorDeps(c, "new-instance"));

    expect(S.lastDspInstanceId).toBe("new-instance");
    expect(S.trackCurrentPage).toEqual([0, 0, 1, 1]);
    expect(S.stateLoading).toBe(true);
    expect(c.log).toEqual([
      ["get", "instance_id"],
      ["pollDSP"],
      ["syncClipsFromDsp"],
      ["syncMuteSoloFromDsp"],
      ["computePadNoteMap"],
      ["invalidateLEDCache"],
      ["forceRedraw"],
    ]);
  });

  test("pending DSP sync decrements first and only refreshes mirrors on the zero tick", () => {
    const c = calls();
    const S = {
      tickCount: 201,
      lastDspInstanceId: "old-instance",
      pendingDspSync: 2,
      stateLoading: true,
      trackCurrentStep: [15, 47],
      trackCurrentPage: [8, 8],
    };

    runDspMirrorResyncTasks(S, dspMirrorDeps(c));
    expect(S.pendingDspSync).toBe(1);
    expect(c.log).toEqual([]);

    runDspMirrorResyncTasks(S, dspMirrorDeps(c));
    expect(S.pendingDspSync).toBe(0);
    expect(S.trackCurrentPage).toEqual([0, 2]);
    expect(S.stateLoading).toBe(false);
    expect(c.log).toEqual([
      ["pollDSP"],
      ["syncClipsFromDsp"],
      ["syncMuteSoloFromDsp"],
      ["restoreUiSidecar", true],
      ["computePadNoteMap"],
      ["invalidateLEDCache"],
      ["forceRedraw"],
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

  test("pending undo sync decrements first and waits until the zero tick", () => {
    const c = calls();
    const S = {
      pendingUndoSync: 2,
      recordArmed: false,
      recordCountingIn: false,
      recordArmedTrack: -1,
    };
    const deps = {
      host_module_get_param: c.fn("get"),
      host_module_set_param: c.fn("set"),
      syncClipsTargeted: c.fn("syncClipsTargeted"),
      clearRecordingNoteBuffers: c.fn("clearRecordingNoteBuffers"),
      invalidateLEDCache: c.fn("invalidateLEDCache"),
      forceRedraw: c.fn("forceRedraw"),
    };

    runPendingUndoSyncTask(S, deps);

    expect(S.pendingUndoSync).toBe(1);
    expect(c.log).toEqual([]);
  });

  test("pending undo sync reads last restore, syncs targeted clips, and redraws on the zero tick", () => {
    const c = calls();
    const S = {
      pendingUndoSync: 1,
      recordArmed: false,
      recordCountingIn: false,
      recordArmedTrack: -1,
    };

    runPendingUndoSyncTask(S, {
      host_module_get_param: (key: string) => {
        c.log.push(["get", key]);
        return "m 0 2";
      },
      host_module_set_param: c.fn("set"),
      syncClipsTargeted: c.fn("syncClipsTargeted"),
      clearRecordingNoteBuffers: c.fn("clearRecordingNoteBuffers"),
      invalidateLEDCache: c.fn("invalidateLEDCache"),
      forceRedraw: c.fn("forceRedraw"),
    });

    expect(S.pendingUndoSync).toBe(0);
    expect(c.log).toEqual([
      ["get", "last_restore"],
      ["syncClipsTargeted", "m 0 2"],
      ["invalidateLEDCache"],
      ["forceRedraw"],
    ]);
  });

  test("pending undo sync re-arms active recording after clearing stale note buffers", () => {
    const c = calls();
    const S = {
      pendingUndoSync: 1,
      recordArmed: true,
      recordCountingIn: false,
      recordArmedTrack: 3,
    };

    runPendingUndoSyncTask(S, {
      host_module_get_param: (key: string) => {
        c.log.push(["get", key]);
        return "d 3 4";
      },
      host_module_set_param: c.fn("set"),
      syncClipsTargeted: c.fn("syncClipsTargeted"),
      clearRecordingNoteBuffers: c.fn("clearRecordingNoteBuffers"),
      invalidateLEDCache: c.fn("invalidateLEDCache"),
      forceRedraw: c.fn("forceRedraw"),
    });

    expect(c.log).toEqual([
      ["get", "last_restore"],
      ["syncClipsTargeted", "d 3 4"],
      ["clearRecordingNoteBuffers"],
      ["set", "t3_recording", "1"],
      ["invalidateLEDCache"],
      ["forceRedraw"],
    ]);
  });

  test("deferred lane edit readback clears stretch check and rolls back on DSP no-room result", () => {
    const c = calls();
    const S = {
      tickCount: 20,
      pendingAllLanesStretchCheck: 2,
      allLanesQntResetTick: -1,
      allLanesQntResetTrack: -1,
      allLanesResResetTick: -1,
      allLanesResResetTrack: -1,
      allLanesDirResetTick: -1,
      allLanesDirResetTrack: -1,
      bankParams: Array.from({ length: 4 }, () => Array.from({ length: 8 }, () => new Array(8).fill(0))),
      knobLastDir: [0, -1],
      screenDirty: false,
    };
    S.bankParams[2][7][1] = 12;

    runDeferredLaneEditReadbackTasks(S, {
      host_module_get_param: (key: string) => {
        c.log.push(["get", key]);
        return "-1";
      },
      showActionPopup: c.fn("popup"),
    });

    expect(S.pendingAllLanesStretchCheck).toBe(-1);
    expect(S.bankParams[2][7][1]).toBe(13);
    expect(S.screenDirty).toBe(false);
    expect(c.log).toEqual([
      ["get", "t2_all_lanes_stretch_result"],
      ["popup", "NO ROOM"],
    ]);
  });

  test("deferred lane edit readback leaves stretch value alone on non-error result", () => {
    const c = calls();
    const S = {
      tickCount: 20,
      pendingAllLanesStretchCheck: 1,
      allLanesQntResetTick: -1,
      allLanesQntResetTrack: -1,
      allLanesResResetTick: -1,
      allLanesResResetTrack: -1,
      allLanesDirResetTick: -1,
      allLanesDirResetTrack: -1,
      bankParams: Array.from({ length: 2 }, () => Array.from({ length: 8 }, () => new Array(8).fill(0))),
      knobLastDir: [0, 1],
      screenDirty: false,
    };
    S.bankParams[1][7][1] = 12;

    runDeferredLaneEditReadbackTasks(S, {
      host_module_get_param: (key: string) => {
        c.log.push(["get", key]);
        return "0";
      },
      showActionPopup: c.fn("popup"),
    });

    expect(S.pendingAllLanesStretchCheck).toBe(-1);
    expect(S.bankParams[1][7][1]).toBe(12);
    expect(c.log).toEqual([["get", "t1_all_lanes_stretch_result"]]);
  });

  test("deferred lane edit readback resets due all-lane UI mirrors and marks screen dirty", () => {
    const c = calls();
    const S = {
      tickCount: 50,
      pendingAllLanesStretchCheck: -1,
      allLanesQntResetTick: 50,
      allLanesQntResetTrack: 0,
      allLanesResResetTick: 49,
      allLanesResResetTrack: 1,
      allLanesDirResetTick: 51,
      allLanesDirResetTrack: 2,
      bankParams: Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => new Array(8).fill(0))),
      knobLastDir: [0, 1],
      screenDirty: false,
    };
    S.bankParams[0][7][3] = 24;
    S.bankParams[1][7][0] = 12;
    S.bankParams[2][7][6] = 1;

    runDeferredLaneEditReadbackTasks(S, {
      host_module_get_param: c.fn("get"),
      showActionPopup: c.fn("popup"),
    });

    expect(S.bankParams[0][7][3]).toBe(-1);
    expect(S.bankParams[1][7][0]).toBe(-1);
    expect(S.bankParams[2][7][6]).toBe(1);
    expect(S.allLanesQntResetTick).toBe(-1);
    expect(S.allLanesQntResetTrack).toBe(-1);
    expect(S.allLanesResResetTick).toBe(-1);
    expect(S.allLanesResResetTrack).toBe(-1);
    expect(S.allLanesDirResetTick).toBe(51);
    expect(S.allLanesDirResetTrack).toBe(2);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([]);
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

  test("content resync applies the same melodic clip readback for step reread and scene bake", () => {
    const c = calls();
    const S = {
      pendingDrumResync: 0,
      pendingDrumLaneResync: 0,
      pendingStepsReread: 1,
      pendingStepsRereadTrack: 0,
      pendingStepsRereadClip: 2,
      pendingSceneBakeResync: 1,
      pendingSceneBakeClip: 3,
      activeDrumLane: [0, 0, 0],
      trackPadMode: [0, 0, 1],
      trackActiveClip: [2, 4, 3],
      clipSteps: Array.from({ length: 3 }, () => Array.from({ length: 8 }, () => new Array(8).fill(0))),
      clipNonEmpty: Array.from({ length: 3 }, () => new Array(8).fill(false)),
      clipLength: Array.from({ length: 3 }, () => new Array(8).fill(16)),
      clipTPS: Array.from({ length: 3 }, () => new Array(8).fill(24)),
    };
    const params = new Map<string, string>([
      ["t0_c2_steps", "12000000"],
      ["t0_c2_length", "32"],
      ["t0_c2_tps", "12"],
      ["t0_c3_steps", "20000000"],
      ["t0_c3_length", "48"],
      ["t0_c3_tps", "99"],
      ["t1_c3_steps", "01000000"],
      ["t1_c3_length", "64"],
      ["t1_c3_tps", "6"],
    ]);

    runDeferredContentResyncTasks(S, {
      NUM_TRACKS: 3,
      NUM_STEPS: 8,
      PAD_MODE_DRUM: 1,
      TPS_VALUES: [6, 12, 24],
      host_module_get_param: (key: string) => {
        c.log.push(["get", key]);
        return params.get(key) ?? null;
      },
      syncDrumClipContent: c.fn("syncDrumClipContent"),
      syncDrumLanesMeta: c.fn("syncDrumLanesMeta"),
      syncDrumLaneSteps: c.fn("syncDrumLaneSteps"),
      refreshDrumLaneBankParams: c.fn("refreshDrumLaneBankParams"),
      refreshPerClipBankParams: c.fn("refreshPerClipBankParams"),
      clipHasContent: (t: number, clip: number) => S.clipSteps[t][clip].some((v: number) => v !== 0),
      forceRedraw: c.fn("forceRedraw"),
    });

    expect(S.clipSteps[0][2].slice(0, 3)).toEqual([1, 2, 0]);
    expect(S.clipNonEmpty[0][2]).toBe(true);
    expect(S.clipLength[0][2]).toBe(32);
    expect(S.clipTPS[0][2]).toBe(12);
    expect(S.clipSteps[0][3].slice(0, 2)).toEqual([2, 0]);
    expect(S.clipTPS[0][3]).toBe(24);
    expect(S.clipSteps[1][3].slice(0, 2)).toEqual([0, 1]);
    expect(S.clipLength[1][3]).toBe(64);
    expect(c.log).toEqual([
      ["get", "t0_c2_steps"],
      ["get", "t0_c2_length"],
      ["get", "t0_c2_tps"],
      ["refreshPerClipBankParams", 0],
      ["forceRedraw"],
      ["get", "t0_c3_steps"],
      ["get", "t0_c3_length"],
      ["get", "t0_c3_tps"],
      ["get", "t1_c3_steps"],
      ["get", "t1_c3_length"],
      ["get", "t1_c3_tps"],
      ["syncDrumClipContent", 2],
      ["syncDrumLanesMeta", 2],
      ["syncDrumLaneSteps", 2, 0],
      ["forceRedraw"],
    ]);
  });

  test("repeat recording lane refresh syncs the active drum lane after content resyncs", () => {
    const c = calls();
    const S = {
      recordArmed: true,
      playing: true,
      sessionView: false,
      activeTrack: 2,
      activeDrumLane: [0, 1, 6],
      trackPadMode: [0, 0, 1],
      drumRepeatHeldPad: [-1, -1, 60],
      drumRepeat2HeldLanes: [new Set(), new Set(), new Set()],
      drumRepeat2LatchedLanes: [new Set(), new Set(), new Set()],
    };

    const handled = runRepeatRecordingLaneRefreshTask(S, {
      PAD_MODE_DRUM: 1,
      syncDrumLaneSteps: c.fn("syncDrumLaneSteps"),
      forceRedraw: c.fn("forceRedraw"),
    });

    expect(handled).toBe(true);
    expect(c.log).toEqual([
      ["syncDrumLaneSteps", 2, 6],
      ["forceRedraw"],
    ]);
  });

  test("repeat recording lane refresh is gated to active drum repeat recording", () => {
    const c = calls();
    const base = {
      recordArmed: true,
      playing: true,
      sessionView: false,
      activeTrack: 0,
      activeDrumLane: [3],
      trackPadMode: [1],
      drumRepeatHeldPad: [-1],
      drumRepeat2HeldLanes: [new Set<number>()],
      drumRepeat2LatchedLanes: [new Set<number>()],
    };
    const deps = {
      PAD_MODE_DRUM: 1,
      syncDrumLaneSteps: c.fn("syncDrumLaneSteps"),
      forceRedraw: c.fn("forceRedraw"),
    };

    expect(runRepeatRecordingLaneRefreshTask(base, deps)).toBe(false);
    base.drumRepeat2HeldLanes[0].add(4);
    base.sessionView = true;
    expect(runRepeatRecordingLaneRefreshTask(base, deps)).toBe(false);
    base.sessionView = false;
    base.trackPadMode[0] = 0;
    expect(runRepeatRecordingLaneRefreshTask(base, deps)).toBe(false);
    base.trackPadMode[0] = 1;
    base.playing = false;
    expect(runRepeatRecordingLaneRefreshTask(base, deps)).toBe(false);

    expect(c.log).toEqual([]);
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

describe("pre-LED reconcile tick steps (batch A1-A12)", () => {
  test("runPendingTrackConvert fires conversion and clears the pending field", () => {
    const c = calls();
    const deps = { convertTrackType: c.fn("convert") };

    const idle = { pendingTrackConvert: null };
    runPendingTrackConvert(idle, deps);
    expect(c.log).toEqual([]);

    const S = { pendingTrackConvert: { t: 2, toDrum: true } };
    runPendingTrackConvert(S, deps);
    expect(S.pendingTrackConvert).toBeNull();
    expect(c.log).toEqual([["convert", 2, true]]);
  });

  test("runPendingPadNoteMapRecompute only fires when the default-drain queue is empty", () => {
    const c = calls();
    const deps = { computePadNoteMap: c.fn("recompute") };

    // gated: queue non-empty
    runPendingPadNoteMapRecompute(
      { pendingPadNoteMapRecompute: true, pendingDefaultSetParams: [1], clearDrainHold: 0 },
      deps,
    );
    // gated: clearDrainHold active
    runPendingPadNoteMapRecompute(
      { pendingPadNoteMapRecompute: true, pendingDefaultSetParams: [], clearDrainHold: 1 },
      deps,
    );
    // gated: flag not set
    runPendingPadNoteMapRecompute(
      { pendingPadNoteMapRecompute: false, pendingDefaultSetParams: [], clearDrainHold: 0 },
      deps,
    );
    expect(c.log).toEqual([]);

    const S = { pendingPadNoteMapRecompute: true, pendingDefaultSetParams: [], clearDrainHold: 0 };
    runPendingPadNoteMapRecompute(S, deps);
    expect(S.pendingPadNoteMapRecompute).toBe(false);
    expect(c.log).toEqual([["recompute"]]);
  });

  test("runExtMidiRemapReapply re-applies only when the remap inputs change", () => {
    const c = calls();
    const deps = { applyExtMidiRemap: c.fn("remap") };
    const S = {
      activeTrack: 1,
      trackRoute: [0, 5, 0],
      trackChannel: [0, 3, 0],
      midiInChannel: 9,
      _lastRemapTrack: -1,
      _lastRemapRoute: -1,
      _lastRemapChannel: -1,
      _lastRemapMidiIn: -2,
    };
    runExtMidiRemapReapply(S, deps);
    expect(c.log).toEqual([["remap"]]);
    expect(S._lastRemapTrack).toBe(1);
    expect(S._lastRemapRoute).toBe(5);
    expect(S._lastRemapChannel).toBe(3);
    expect(S._lastRemapMidiIn).toBe(9);

    // unchanged → no re-apply
    c.log.length = 0;
    runExtMidiRemapReapply(S, deps);
    expect(c.log).toEqual([]);

    // a single input change re-triggers
    S.midiInChannel = 10;
    runExtMidiRemapReapply(S, deps);
    expect(c.log).toEqual([["remap"]]);
    expect(S._lastRemapMidiIn).toBe(10);
  });

  test("runSessionViewEdgeTasks resets TARP latch on entry and repushes padmap on the edge", () => {
    const c = calls();
    const deps = {
      host_module_set_param: c.fn("set"),
      computePadNoteMap: c.fn("recompute"),
    };
    const bankParams = [[[], [], [], [], [], [0, 0, 0, 0, 0, 0, 0, 1]]];
    const S = { sessionView: true, _lastSessionView: false, activeTrack: 0, bankParams };

    runSessionViewEdgeTasks(S, deps);
    expect(bankParams[0][5][7]).toBe(0);
    expect(c.log).toEqual([
      ["set", "t0_tarp_latch", "0"],
      ["recompute"],
    ]);
    expect(S._lastSessionView).toBe(true);

    // no edge → no recompute, no tarp reset
    c.log.length = 0;
    runSessionViewEdgeTasks(S, deps);
    expect(c.log).toEqual([]);

    // leaving session view is an edge → recompute (no tarp reset on exit)
    S.sessionView = false;
    runSessionViewEdgeTasks(S, deps);
    expect(c.log).toEqual([["recompute"]]);
    expect(S._lastSessionView).toBe(false);
  });

  test("runDeferredCcBitsRefresh clears step-edit flag and re-reads cc bits/rest", () => {
    const c = calls();
    const deps = {
      host_module_get_param: (key: string) => {
        c.log.push(["get", key]);
        if (key.endsWith("_cc_auto_bits")) return "5";
        if (key.endsWith("_cc_rest")) return "10 -1 200 64 0 0 0 0";
        return null;
      },
      invalidateLEDCache: c.fn("invalidate"),
    };
    const S = {
      ccStepEditActive: true,
      heldStep: -1,
      pendingCCBitsRefresh: 3,
      activeTrack: 1,
      trackCCAutoBits: [[], [0, 0, 0, 0]],
      clipCCVal: [[], [[], [], [], new Array(8).fill(0)]],
    };
    runDeferredCcBitsRefresh(S, deps);
    expect(S.ccStepEditActive).toBe(false);
    expect(S.pendingCCBitsRefresh).toBe(-1);
    expect(S.trackCCAutoBits[1][3]).toBe(5);
    // out-of-range (-1, 200) clamp to -1; in-range preserved
    expect(S.clipCCVal[1][3]).toEqual([10, -1, -1, 64, 0, 0, 0, 0]);
    expect(c.log.at(-1)).toEqual(["invalidate"]);

    // step-edit flag NOT cleared while a step is held; no refresh when idx < 0
    c.log.length = 0;
    const held = { ccStepEditActive: true, heldStep: 4, pendingCCBitsRefresh: -1 };
    runDeferredCcBitsRefresh(held, deps);
    expect(held.ccStepEditActive).toBe(true);
    expect(c.log).toEqual([]);
  });

  test("runCcLiveValPoll fills live CC values only on bank 6 while playing", () => {
    const c = calls();
    const deps = {
      host_module_get_param: (key: string) => {
        c.log.push(["get", key]);
        return "0 64 200 -1 127 0 0 0";
      },
    };
    const S = {
      activeBank: 6,
      playing: true,
      sessionView: false,
      ccStepEditActive: false,
      activeTrack: 2,
      trackCCLiveVal: [[], [], new Array(8).fill(99)],
    };
    runCcLiveValPoll(S, deps);
    expect(S.trackCCLiveVal[2]).toEqual([0, 64, -1, -1, 127, 0, 0, 0]);

    // gated off when not playing
    c.log.length = 0;
    runCcLiveValPoll({ ...S, playing: false }, deps);
    expect(c.log).toEqual([]);
  });

  test("runSchLabelFetch advances one lane per tick and fetches Sch labels", () => {
    const c = calls();
    const deps = {
      shadow_get_param: (slot: number, key: string) => {
        c.log.push(["shadow", slot, key]);
        return "Cutoff";
      },
      schSlotForTrack: () => 1,
    };
    const S = {
      schLabelFetchLane: 0,
      activeTrack: 0,
      trackCCType: [[2, 0, 0, 0, 0, 0, 0, 0]],
      trackCCAssign: [[12, 0, 0, 0, 0, 0, 0, 0]],
      schLabel: [new Array(8).fill(null)],
      screenDirty: false,
    };
    runSchLabelFetch(S, deps);
    expect(S.schLabelFetchLane).toBe(1);
    expect(S.schLabel[0][0]).toBe("Cutoff");
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([["shadow", 1, "knob_12_param"]]);

    // lane 7 → resets sentinel to -1
    S.schLabelFetchLane = 7;
    S.trackCCType[0][7] = 0;
    runSchLabelFetch(S, deps);
    expect(S.schLabelFetchLane).toBe(-1);

    // sentinel -1 → no-op
    c.log.length = 0;
    runSchLabelFetch(S, deps);
    expect(c.log).toEqual([]);
  });

  test("runCcGradientPalette writes palette + transport LEDs once per track on bank 6", () => {
    const c = calls();
    const deps = {
      PAD_MODE_DRUM: 1,
      CC_GRADIENT_LEVELS: 2,
      CC_GRADIENT_SCALARS: [0.5, 1.0],
      CC_GRADIENT_BASE: 60,
      MovePlay: 91,
      MoveRec: 93,
      MoveSample: 94,
      Green: 1,
      Red: 2,
      LED_OFF: 0,
      setPaletteEntryRGB: c.fn("palette"),
      reapplyPalette: c.fn("reapply"),
      setButtonLED: c.fn("led"),
      invalidateLEDCache: c.fn("invalidate"),
    };
    const S = {
      activeBank: 6,
      sessionView: false,
      trackPadMode: [0],
      activeTrack: 0,
      ccGradPaletteTrack: -1,
      playing: true,
      recordArmed: false,
      recordScheduledStop: false,
      dspMergeState: 0,
      _forceKnobReemit: false,
    };
    runCcGradientPalette(S, deps);
    expect(S.ccGradPaletteTrack).toBe(0);
    expect(S._forceKnobReemit).toBe(true);
    expect(c.log.filter(([n]) => n === "palette")).toHaveLength(2);
    expect(c.log).toContainEqual(["palette", 60, 128, 128, 128]);
    expect(c.log).toContainEqual(["led", 91, 1, true]); // play green, force
    expect(c.log).toContainEqual(["led", 93, 0, true]); // rec off, force

    // already painted for this track → no-op
    c.log.length = 0;
    runCcGradientPalette(S, deps);
    expect(c.log).toEqual([]);

    // drum track swallows it
    c.log.length = 0;
    runCcGradientPalette({ ...S, ccGradPaletteTrack: -1, trackPadMode: [1] }, deps);
    expect(c.log).toEqual([]);
  });

  test("runPendingSetLoad sends state_load and arms the dsp resync, gated by the inherit picker", () => {
    const c = calls();
    const deps = {
      host_module_set_param: c.fn("set"),
      disarmRecord: c.fn("disarm"),
    };
    const make = () => ({
      pendingSetLoad: true,
      pendingInheritPicker: false,
      stateLoading: false,
      heldStep: 4,
      heldStepBtn: 4,
      heldStepNotes: [1],
      stepWasEmpty: true,
      stepWasHeld: true,
      seqActiveNotes: new Set([1, 2]),
      seqLastStep: 5,
      seqLastClip: 1,
      pendingDspSync: 0,
      currentSetUuid: "abc",
    });

    const S = make();
    runPendingSetLoad(S, deps);
    expect(S.pendingSetLoad).toBe(false);
    expect(S.stateLoading).toBe(true);
    expect(S.heldStep).toBe(-1);
    expect(S.seqActiveNotes.size).toBe(0);
    expect(S.pendingDspSync).toBe(5);
    expect(c.log).toEqual([["disarm"], ["set", "state_load", "abc"]]);

    // suppressed while inherit picker is open
    c.log.length = 0;
    const picker = { ...make(), pendingInheritPicker: true };
    runPendingSetLoad(picker, deps);
    expect(picker.pendingSetLoad).toBe(true);
    expect(c.log).toEqual([]);
  });

  test("runGlobalMenuParamPreview previews on value change and re-commits on edit exit", () => {
    const setCalls: number[] = [];
    const item = { set: (v: number) => setCalls.push(v), get: () => 120 };
    const S: any = {
      globalMenuOpen: true,
      globalMenuItems: [item],
      globalMenuState: { selectedIndex: 0, editing: true, editValue: 100 },
      lastSentMenuEditValue: null,
      bpmWasEditing: false,
      screenDirty: false,
    };
    runGlobalMenuParamPreview(S);
    expect(setCalls).toEqual([100]);
    expect(S.lastSentMenuEditValue).toBe(100);
    expect(S.bpmWasEditing).toBe(true);
    expect(S.screenDirty).toBe(true);

    // same value → no duplicate set
    runGlobalMenuParamPreview(S);
    expect(setCalls).toEqual([100]);

    // editing stops → re-commit via get() and reset preview memo
    S.globalMenuState.editing = false;
    runGlobalMenuParamPreview(S);
    expect(setCalls).toEqual([100, 120]);
    expect(S.bpmWasEditing).toBe(false);
    expect(S.lastSentMenuEditValue).toBeNull();
  });

  test("runTransposePreviewSelfHeal cancels a stranded preview left off Key/Scale", () => {
    const c = calls();
    const deps = { xposeCancelPreview: c.fn("cancel") };

    // stranded preview, menu closed → cancel
    const closed = {
      xposePrevKey: 2,
      confirmXpose: false,
      globalMenuOpen: false,
      globalMenuState: null,
      globalMenuItems: null,
    };
    runTransposePreviewSelfHeal(closed, deps);
    expect(c.log).toEqual([["cancel"]]);

    // stranded confirm dialog off Key/Scale → cancel + clear flag
    c.log.length = 0;
    const confirm = {
      xposePrevKey: null,
      confirmXpose: true,
      globalMenuOpen: true,
      globalMenuState: { selectedIndex: 0, editing: true },
      globalMenuItems: [{ label: "Swing" }],
    };
    runTransposePreviewSelfHeal(confirm, deps);
    expect(confirm.confirmXpose).toBe(false);
    expect(c.log).toEqual([["cancel"]]);

    // still on Key edit → leave preview alone
    c.log.length = 0;
    const onKey = {
      xposePrevKey: 2,
      confirmXpose: false,
      globalMenuOpen: true,
      globalMenuState: { selectedIndex: 0, editing: true },
      globalMenuItems: [{ label: "Key" }],
    };
    runTransposePreviewSelfHeal(onKey, deps);
    expect(c.log).toEqual([]);
  });
});
