import { describe, expect, test } from "vitest";
import { handleUiPlayButton, handleUiRecordButton } from "@tool-ui/ui_transport_cc_workflow.mjs";

function calls() {
  const log: Array<[string, ...unknown[]]> = [];
  return {
    log,
    fn(name: string) {
      return (...args: unknown[]) => log.push([name, ...args]);
    },
  };
}

function state(overrides = {}) {
  return {
    deleteHeld: false,
    muteHeld: false,
    muteUsedAsModifier: false,
    loopHeld: false,
    shiftHeld: false,
    sessionView: false,
    playing: false,
    recordCountingIn: false,
    recordArmed: false,
    recordArmedTrack: -1,
    recordPendingPage: false,
    recordScheduledStop: false,
    recordScheduledStopTarget: -1,
    recordBlockedDialog: false,
    recordBlockedDialogSel: 1,
    recordBpm: 0,
    tickCount: 1000,
    activeTrack: 1,
    trackPadMode: [1, 0, 0, 0],
    drumStepPage: [2, 3, 0, 0],
    trackCurrentPage: [0, 4, 0, 0],
    activeDrumLane: [5, 6, 0, 0],
    trackClipPlaying: [false, false, false, false],
    trackWillRelaunch: [true, false, true, true],
    trackQueuedClip: [1, -1, 2, 3],
    trackActiveClip: [0, 7, 0, 0],
    trackCurrentStep: [0, 35, 0, 0],
    drumCurrentStep: [47, 0, 0, 0],
    clipPlaybackDir: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    drumLanePlaybackDir: [
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0, 0],
    ],
    clipAdaptiveMode: [
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
    ],
    clipNonEmpty: [
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
    ],
    drumClipNonEmpty: [
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
    ],
    clipLengthManuallySet: [
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
      [false, false, false, false, false, false, false, false],
    ],
    drumLaneLengthManuallySet: [false, false, false, false],
    pendingPrerollNotes: [1],
    pendingPrerollToggleQueue: [2],
    undoAvailable: false,
    redoAvailable: true,
    undoSeqArpSnapshot: { old: true },
    metronomeOn: 1,
    metronomeOnLast: 3,
    ...overrides,
  };
}

function deps(c: ReturnType<typeof calls>, overrides = {}) {
  return {
    disarmRecord: c.fn("disarm"),
    focusedClipIsEmpty: (...args: unknown[]) => {
      c.log.push(["focusedClipIsEmpty", ...args]);
      return true;
    },
    forceRedraw: c.fn("redraw"),
    getParam: (...args: unknown[]) => {
      c.log.push(["getParam", ...args]);
      return "120";
    },
    movePlay: 85,
    moveRec: 86,
    numTracks: 4,
    padModeDrum: 1,
    red: 5,
    setButtonLED: (...args: unknown[]) => c.log.push(["led", ...args]),
    setParam: (...args: unknown[]) => c.log.push(["setParam", ...args]),
    showActionPopup: c.fn("popup"),
    unlatchAllTracks: c.fn("unlatch"),
    ...overrides,
  };
}

describe("Transport CC workflow - Play button", () => {
  test("ignores non-Play CCs and non-press Play values", () => {
    const c = calls();
    const S = state();
    const d = deps(c);

    expect(handleUiPlayButton(S, d, 84, 127)).toBeUndefined();
    expect(handleUiPlayButton(S, d, 85, 0)).toBeUndefined();

    expect(c.log).toEqual([]);
  });

  test("Delete+Play while stopped sends panic and clears queued relaunch mirrors", () => {
    const c = calls();
    const S = state({ deleteHeld: true, playing: false });

    handleUiPlayButton(S, deps(c), 85, 127);

    expect(c.log).toEqual([
      ["setParam", "transport", "panic"],
      ["unlatch"],
    ]);
    expect(S.trackWillRelaunch).toEqual([false, false, false, false]);
    expect(S.trackQueuedClip).toEqual([-1, -1, -1, -1]);
  });

  test("Delete+Play while playing deactivates all and unlatches tracks", () => {
    const c = calls();
    const S = state({ deleteHeld: true, playing: true });

    handleUiPlayButton(S, deps(c), 85, 127);

    expect(c.log).toEqual([
      ["setParam", "transport", "deactivate_all"],
      ["unlatch"],
    ]);
    expect(S.trackWillRelaunch).toEqual([true, false, true, true]);
    expect(S.trackQueuedClip).toEqual([1, -1, 2, 3]);
  });

  test("Mute+Play toggles the metronome and marks mute as a modifier", () => {
    const c = calls();
    const S = state({ muteHeld: true, metronomeOn: 2, metronomeOnLast: 3 });

    handleUiPlayButton(S, deps(c), 85, 127);

    expect(S.muteUsedAsModifier).toBe(true);
    expect(S.metronomeOnLast).toBe(2);
    expect(S.metronomeOn).toBe(0);
    expect(c.log).toEqual([
      ["setParam", "metro_on", "0"],
      ["popup", "METRO OFF"],
    ]);
  });

  test("Mute+Play restores the previous metronome mode when currently off", () => {
    const c = calls();
    const S = state({ muteHeld: true, metronomeOn: 0, metronomeOnLast: 3 });

    handleUiPlayButton(S, deps(c), 85, 127);

    expect(S.metronomeOn).toBe(3);
    expect(c.log).toEqual([
      ["setParam", "metro_on", "3"],
      ["popup", "METRO ON"],
    ]);
  });

  test("Loop+Play in Track View restarts at the visible melodic page", () => {
    const c = calls();
    const S = state({ loopHeld: true, activeTrack: 1, sessionView: false });

    handleUiPlayButton(S, deps(c), 85, 127);

    expect(c.log).toEqual([
      ["setParam", "transport", "restart_at:1:4:-1"],
    ]);
  });

  test("Loop+Play in Track View restarts at the visible drum page and lane", () => {
    const c = calls();
    const S = state({ loopHeld: true, activeTrack: 0, sessionView: false });

    handleUiPlayButton(S, deps(c), 85, 127);

    expect(c.log).toEqual([
      ["setParam", "transport", "restart_at:0:2:5"],
    ]);
  });

  test("Loop+Play in Session View falls through to normal play", () => {
    const c = calls();
    const S = state({ loopHeld: true, sessionView: true });

    handleUiPlayButton(S, deps(c), 85, 127);

    expect(c.log).toEqual([
      ["setParam", "transport", "play"],
    ]);
  });

  test("Shift+Play restarts while playing and plays while stopped", () => {
    const c = calls();

    handleUiPlayButton(state({ shiftHeld: true, playing: true }), deps(c), 85, 127);
    handleUiPlayButton(state({ shiftHeld: true, playing: false }), deps(c), 85, 127);

    expect(c.log).toEqual([
      ["setParam", "transport", "restart"],
      ["setParam", "transport", "play"],
    ]);
  });

  test("plain Play during count-in disarms recording instead of toggling transport", () => {
    const c = calls();
    const S = state({ recordCountingIn: true });

    handleUiPlayButton(S, deps(c), 85, 127);

    expect(c.log).toEqual([["disarm"]]);
  });

  test("plain Play from stopped Track View queues the empty focused clip atomically", () => {
    const c = calls();
    const S = state({ activeTrack: 1, playing: false, sessionView: false });

    handleUiPlayButton(S, deps(c), 85, 127);

    expect(c.log).toEqual([
      ["focusedClipIsEmpty", 1],
      ["setParam", "transport", "play_focus:1:7"],
    ]);
    expect(S.trackQueuedClip[1]).toBe(7);
  });

  test("plain Play toggles transport when focus-play preconditions are not met", () => {
    const c = calls();

    handleUiPlayButton(state({ playing: true }), deps(c), 85, 127);
    handleUiPlayButton(state({ playing: false, sessionView: true }), deps(c), 85, 127);
    handleUiPlayButton(
      state({ playing: false, trackClipPlaying: [false, true, false, false] }),
      deps(c),
      85,
      127
    );
    handleUiPlayButton(
      state({ playing: false }),
      deps(c, { focusedClipIsEmpty: () => false }),
      85,
      127
    );

    expect(c.log).toEqual([
      ["setParam", "transport", "stop"],
      ["setParam", "transport", "play"],
      ["setParam", "transport", "play"],
      ["setParam", "transport", "play"],
    ]);
  });
});

describe("Transport CC workflow - Record button", () => {
  test("ignores non-Record CCs and non-press Record values", () => {
    const c = calls();
    const S = state();
    const d = deps(c);

    expect(handleUiRecordButton(S, d, 85, 127)).toBeUndefined();
    expect(handleUiRecordButton(S, d, 86, 0)).toBeUndefined();

    expect(c.log).toEqual([]);
  });

  test("armed count-in Record press disarms recording", () => {
    const c = calls();
    const S = state({ recordArmed: true, recordCountingIn: true });

    handleUiRecordButton(S, deps(c), 86, 127);

    expect(c.log).toEqual([["disarm"]]);
  });

  test("armed adaptive clip while playing schedules stop at the next page boundary", () => {
    const c = calls();
    const S = state({ recordArmed: true, recordArmedTrack: 1, playing: true });
    S.clipAdaptiveMode[1][7] = true;

    handleUiRecordButton(S, deps(c), 86, 127);

    expect(c.log).toEqual([]);
    expect(S.recordScheduledStop).toBe(true);
    expect(S.recordScheduledStopTarget).toBe(48);
  });

  test("armed adaptive drum clip schedules stop from the drum current step", () => {
    const c = calls();
    const S = state({ recordArmed: true, recordArmedTrack: 0, playing: true });
    S.clipAdaptiveMode[0][0] = true;

    handleUiRecordButton(S, deps(c), 86, 127);

    expect(S.recordScheduledStop).toBe(true);
    expect(S.recordScheduledStopTarget).toBe(48);
  });

  test("armed non-adaptive Record press disarms", () => {
    const c = calls();
    const S = state({ recordArmed: true, recordArmedTrack: 1, playing: true });

    handleUiRecordButton(S, deps(c), 86, 127);

    expect(c.log).toEqual([["disarm"]]);
  });

  test("reverse melodic playback direction opens the record-blocked dialog", () => {
    const c = calls();
    const S = state();
    S.clipPlaybackDir[1][7] = 2;

    handleUiRecordButton(S, deps(c), 86, 127);

    expect(S.recordBlockedDialog).toBe(true);
    expect(S.recordBlockedDialogSel).toBe(0);
    expect(c.log).toEqual([["redraw"]]);
  });

  test("reverse drum lane playback direction opens the record-blocked dialog", () => {
    const c = calls();
    const S = state({ activeTrack: 0 });
    S.drumLanePlaybackDir[0][5] = 1;

    handleUiRecordButton(S, deps(c), 86, 127);

    expect(S.recordBlockedDialog).toBe(true);
    expect(c.log).toEqual([["redraw"]]);
  });

  test("stopped unarmed Record starts count-in and uses the host BPM", () => {
    const c = calls();
    const S = state({ playing: false, tickCount: 222 });

    handleUiRecordButton(S, deps(c, { getParam: () => "98" }), 86, 127);

    expect(S.recordArmed).toBe(true);
    expect(S.recordCountingIn).toBe(true);
    expect(S.recordArmedTrack).toBe(1);
    expect(S.recordBpm).toBe(98);
    expect(S.countInStartTick).toBe(222);
    expect(S.countInBeatStartTick).toBe(222);
    expect(S.countInQuarterTicks).toBe(Math.round(196 * 60 / 98));
    expect(S.pendingPrerollNotes).toEqual([]);
    expect(S.pendingPrerollToggleQueue).toEqual([]);
    expect(S.undoAvailable).toBe(true);
    expect(S.redoAvailable).toBe(false);
    expect(S.undoSeqArpSnapshot).toBeNull();
    expect(c.log).toEqual([
      ["setParam", "record_count_in", "1"],
      ["led", 86, 5],
    ]);
  });

  test("stopped unarmed Record falls back to 120 BPM when host BPM is invalid", () => {
    const c = calls();
    const S = state({ playing: false });

    handleUiRecordButton(S, deps(c, { getParam: () => "bad" }), 86, 127);

    expect(S.recordBpm).toBe(120);
    expect(S.countInQuarterTicks).toBe(98);
  });

  test("playing unarmed adaptive melodic recording sends deferred recording mode", () => {
    const c = calls();
    const S = state({ playing: true, activeTrack: 1 });

    handleUiRecordButton(S, deps(c, { getParam: () => "110" }), 86, 127);

    expect(S.recordArmed).toBe(true);
    expect(S.recordCountingIn).toBe(false);
    expect(S.recordArmedTrack).toBe(1);
    expect(S.recordPendingPage).toBe(true);
    expect(S.recordBpm).toBe(110);
    expect(S.clipAdaptiveMode[1][7]).toBe(true);
    expect(c.log).toEqual([
      ["led", 86, 5],
      ["setParam", "t1_recording", "2"],
    ]);
  });

  test("playing unarmed fixed melodic recording sends immediate recording mode", () => {
    const c = calls();
    const S = state({ playing: true, activeTrack: 1 });
    S.clipNonEmpty[1][7] = true;

    handleUiRecordButton(S, deps(c), 86, 127);

    expect(S.recordPendingPage).toBe(false);
    expect(S.clipAdaptiveMode[1][7]).toBe(false);
    expect(c.log).toEqual([
      ["getParam", "bpm"],
      ["led", 86, 5],
      ["setParam", "t1_recording", "1"],
    ]);
  });

  test("playing unarmed adaptive drum recording checks drum content and lane length", () => {
    const c = calls();
    const S = state({ playing: true, activeTrack: 0 });

    handleUiRecordButton(S, deps(c), 86, 127);

    expect(S.recordPendingPage).toBe(true);
    expect(S.clipAdaptiveMode[0][0]).toBe(true);
    expect(c.log).toEqual([
      ["getParam", "bpm"],
      ["led", 86, 5],
      ["setParam", "t0_recording", "2"],
    ]);
  });

  test("playing unarmed fixed drum recording sends immediate recording mode", () => {
    const c = calls();
    const S = state({ playing: true, activeTrack: 0 });
    S.drumLaneLengthManuallySet[0] = true;

    handleUiRecordButton(S, deps(c), 86, 127);

    expect(S.recordPendingPage).toBe(false);
    expect(c.log).toEqual([
      ["getParam", "bpm"],
      ["led", 86, 5],
      ["setParam", "t0_recording", "1"],
    ]);
  });
});
