import { describe, expect, test } from "vitest";
import {
  createInitialControlState,
  selectClipCell as selectControlClipCell,
  selectTrack,
  setShiftHeld,
  toggleControlMode,
} from "../../../src/core/control-state";
import { interpretControl } from "../../../src/core/controls/interpret-control";
import { applyIntent } from "../../../src/core/intents/apply-intent";
import { createPlaybackState } from "../../../src/core/playback";
import { createDefaultProject, getClipCell, getClipForCell } from "../../../src/core/project";
import { createTransport } from "../../../src/core/transport";
import type { CoreState, HostCommand } from "../../../src/core/types";

describe("Overture Next control-to-intent pipeline", () => {
  test("interprets track rows against the current shift modifier", () => {
    const lowerBankControl = createInitialControlState();
    const upperBankControl = createInitialControlState();
    setShiftHeld(upperBankControl, true);

    expect(interpretControl({ kind: "track-row", row: 1 }, lowerBankControl)).toEqual({
      kind: "select-track",
      trackIndex: 1,
    });

    expect(interpretControl({ kind: "track-row", row: 1 }, upperBankControl)).toEqual({
      kind: "select-track",
      trackIndex: 5,
    });
  });

  test("interprets Track View central pads as selected-track note audition", () => {
    expect(interpretControl(padPress(7, 101), createInitialControlState())).toEqual({
      kind: "audition-note",
      held: true,
      note: 67,
      trackIndex: 0,
      velocity: 101,
    });
    expect(interpretControl(padRelease(7), createInitialControlState())).toEqual({
      kind: "audition-note",
      held: false,
      note: 67,
      trackIndex: 0,
      velocity: 0,
    });
  });

  test("interprets Session View pads as Clip Cell launch without leaking pad indexes", () => {
    const control = createInitialControlState();
    selectTrack(control, 4);
    toggleControlMode(control);

    const intent = interpretControl(padPress(26), control);

    expect(intent).toEqual({ kind: "launch-clip-cell", coordinate: { trackIndex: 4, sceneIndex: 2 } });
    expect(intent).not.toHaveProperty("padIndex");
  });

  test("applies clip-cell selection without creating clips", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const clipCount = Object.keys(state.project.clips).length;

    expect(
      applyIntentAndCollect(
        { kind: "select-clip-cell", coordinate: { trackIndex: 3, sceneIndex: 7 } },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(state.control.selectedTrackIndex).toBe(3);
    expect(state.control.selectedClipCell).toEqual({ trackIndex: 3, sceneIndex: 7 });
    expect(Object.keys(state.project.clips)).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("applies Clip Cell launch as playback state and explicit UI selection", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const clipCount = Object.keys(state.project.clips).length;

    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate: { trackIndex: 2, sceneIndex: 0 } },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(state.control.selectedTrackIndex).toBe(2);
    expect(state.control.selectedClipCell).toEqual({ trackIndex: 2, sceneIndex: 0 });
    expect(state.playback.tracks[2].playingClipId).toBe("clip-3");
    expect(Object.keys(state.project.clips)).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("starting transport launches the selected clip when present", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);
    expect(state.transport.playing).toBe(true);
    expect(state.playback.tracks[0].playingClipId).toBe("clip-1");
    expect(hostCommands).toEqual([
      { kind: "track-note-on", route: { kind: "move", moveTrackTarget: 0 }, trackIndex: 0, note: 60, velocity: 100 },
    ]);
  });

  test("applies transport toggle without selected-track note-off when no clips are playing", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    selectControlClipCell(state.control, { trackIndex: 0, sceneIndex: 7 });

    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);
    expect(state.transport.playing).toBe(true);
    expect(state.playback.tracks[0].playingClipId).toBeNull();
    expect(hostCommands).toEqual([]);

    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);
    expect(state.transport.playing).toBe(false);
    expect(hostCommands).toEqual([]);
  });

  test("stopping transport emits note-off for playing clips, not the selected Clip Cell", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate: { trackIndex: 2, sceneIndex: 0 } },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(
      applyIntentAndCollect(
        { kind: "select-clip-cell", coordinate: { trackIndex: 0, sceneIndex: 0 } },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);
    hostCommands.length = 0;
    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);

    expect(hostCommands).toEqual([
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 2 }, trackIndex: 2, note: 60 },
    ]);
  });

  test("stopping transport emits note-off for Schwung-routed playing clips", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate: { trackIndex: 4, sceneIndex: 0 } },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);
    hostCommands.length = 0;
    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);

    expect(hostCommands).toEqual([
      { kind: "track-note-off", route: { kind: "schwung", schwungChainIndex: 0 }, trackIndex: 4, note: 60 },
    ]);
  });

  test("launching an empty Schwung Clip Cell stops that Track via its route", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    state.transport.playhead = 4;

    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate: { trackIndex: 4, sceneIndex: 0 } },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate: { trackIndex: 4, sceneIndex: 7 } },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(state.playback.tracks[4].playingClipId).toBeNull();
    expect(hostCommands).toEqual([
      { kind: "track-note-off", route: { kind: "schwung", schwungChainIndex: 0 }, trackIndex: 4, note: 64 },
    ]);
  });

  test("returns emitted host commands as a Domain Intent transaction", () => {
    const state = createTestCoreState();

    expect(applyIntent({ kind: "launch-clip-cell", coordinate: { trackIndex: 2, sceneIndex: 0 } }, state)).toEqual({
      applied: true,
      hostCommands: [],
    });
    expect(applyIntent({ kind: "toggle-transport" }, state)).toEqual({
      applied: true,
      hostCommands: [
        { kind: "track-note-on", route: { kind: "move", moveTrackTarget: 2 }, trackIndex: 2, note: 60, velocity: 100 },
      ],
    });

    expect(applyIntent({ kind: "toggle-transport" }, state)).toEqual({
      applied: true,
      hostCommands: [
        { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 2 }, trackIndex: 2, note: 60 },
      ],
    });
  });

  test("applies track selection while preserving the selected scene", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    selectControlClipCell(state.control, { trackIndex: 0, sceneIndex: 7 });

    expect(applyIntentAndCollect({ kind: "select-track", trackIndex: 5 }, state, hostCommands)).toBe(true);

    expect(state.control.selectedTrackIndex).toBe(5);
    expect(state.control.visibleTrackBank).toBe(1);
    expect(state.control.selectedClipCell).toEqual({ trackIndex: 5, sceneIndex: 7 });
    expect(hostCommands).toEqual([]);
  });

  test("applies step toggles only to the selected clip sequence", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const selectedClip = getClipForCell(state.project, state.control.selectedClipCell);
    const otherClipId = getClipCell(state.project, { trackIndex: 1, sceneIndex: 0 }).clipId;
    if (!selectedClip || !otherClipId) throw new Error("Expected default clips");
    const otherClip = state.project.clips[otherClipId];

    expect(selectedClip.sequence.steps[1].active).toBe(false);
    expect(otherClip.sequence.steps[1].active).toBe(false);

    expect(applyIntentAndCollect({ kind: "toggle-step", stepIndex: 1 }, state, hostCommands)).toBe(true);

    expect(state.control.selectedStep).toBe(1);
    expect(selectedClip.sequence.steps[1].active).toBe(true);
    expect(otherClip.sequence.steps[1].active).toBe(false);
    expect(hostCommands).toEqual([]);
  });

  test("applies shift state without changing selection or host commands", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(applyIntentAndCollect({ kind: "set-shift-held", held: true }, state, hostCommands)).toBe(true);

    expect(state.control.shiftHeld).toBe(true);
    expect(state.control.selectedTrackIndex).toBe(0);
    expect(state.control.selectedClipCell).toEqual({ trackIndex: 0, sceneIndex: 0 });
    expect(hostCommands).toEqual([]);
  });

  test("lets domain guards reject invalid track and clip-cell coordinates", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(() => applyIntentAndCollect({ kind: "select-track", trackIndex: 99 }, state, hostCommands)).toThrow(
      "Missing track 99",
    );
    expect(() =>
      applyIntentAndCollect(
        { kind: "select-clip-cell", coordinate: { trackIndex: 0, sceneIndex: 99 } },
        state,
        hostCommands,
      ),
    ).toThrow("Missing clip cell 0:99");
    expect(hostCommands).toEqual([]);
  });
});

function padPress(padIndex: number, velocity = 100) {
  return { kind: "pad" as const, held: true, padIndex, velocity };
}

function padRelease(padIndex: number) {
  return { kind: "pad" as const, held: false, padIndex, velocity: 0 };
}

function createTestCoreState(): CoreState {
  return {
    control: createInitialControlState(),
    transport: createTransport(),
    playback: createPlaybackState(),
    project: createDefaultProject(),
    lastInjectedStep: -1,
  };
}

function applyIntentAndCollect(
  intent: Parameters<typeof applyIntent>[0],
  state: Parameters<typeof applyIntent>[1],
  hostCommands: HostCommand[],
): boolean {
  const transaction = applyIntent(intent, state);
  hostCommands.push(...transaction.hostCommands);
  return transaction.applied;
}
