import { describe, expect, test } from "vitest";
import { handleUiPlayButton } from "@tool-ui/ui_transport_cc_workflow.mjs";

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
    activeTrack: 1,
    trackPadMode: [1, 0, 0, 0],
    drumStepPage: [2, 3, 0, 0],
    trackCurrentPage: [0, 4, 0, 0],
    activeDrumLane: [5, 6, 0, 0],
    trackClipPlaying: [false, false, false, false],
    trackWillRelaunch: [true, false, true, true],
    trackQueuedClip: [1, -1, 2, 3],
    trackActiveClip: [0, 7, 0, 0],
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
    movePlay: 85,
    numTracks: 4,
    padModeDrum: 1,
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
