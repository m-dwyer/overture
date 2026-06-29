import { describe, expect, test } from "vitest";
import { createInitialControlSurfaceContext } from "../../../src/state/control-surface-context";
import { interpretControl } from "../../../src/application/controls/interpret-control";
import { applyIntent } from "../../../src/application/intents/apply-intent";
import { createPlayback } from "../../../src/application/playback";
import { createDefaultProject } from "../../../src/state/project";
import { createTransport } from "../../../src/application/transport";
import type { CoreState, HostCommand } from "../../../src/application/types";

describe("Overture Next control-to-intent pipeline", () => {
  test("interprets track rows against the current shift modifier", () => {
    const lowerBankControl = createInitialControlSurfaceContext();
    const upperBankControl = createInitialControlSurfaceContext();
    upperBankControl.setShiftHeld(true);

    expect(interpretControl({ kind: "track-row", row: 1 }, lowerBankControl.snapshot())).toEqual({
      kind: "select-track",
      trackIndex: 1,
    });

    expect(interpretControl({ kind: "track-row", row: 1 }, upperBankControl.snapshot())).toEqual({
      kind: "select-track",
      trackIndex: 5,
    });
  });

  test("interprets Track View central pads as selected-track note audition", () => {
    expect(interpretControl(padPress(7, 101), createInitialControlSurfaceContext().snapshot())).toEqual({
      kind: "audition-note",
      held: true,
      note: 67,
      trackIndex: 0,
      velocity: 101,
    });
    expect(interpretControl(padRelease(7), createInitialControlSurfaceContext().snapshot())).toEqual({
      kind: "audition-note",
      held: false,
      note: 67,
      trackIndex: 0,
      velocity: 0,
    });
  });

  test("interprets Session View pads as Clip Cell launch without leaking pad indexes", () => {
    const control = createInitialControlSurfaceContext();
    control.selectTrackPreservingScene(4);
    control.toggleActiveView();

    const intent = interpretControl(padPress(26), control.snapshot());

    expect(intent).toEqual({ kind: "launch-clip-cell", coordinate: { trackIndex: 4, sceneIndex: 2 } });
    expect(intent).not.toHaveProperty("padIndex");
  });

  test("applies clip-cell selection without creating clips", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const clipCount = state.project.clipCellSnapshots().filter((cell) => cell.clipId).length;

    expect(
      applyIntentAndCollect(
        { kind: "select-clip-cell", coordinate: { trackIndex: 3, sceneIndex: 7 } },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(state.control.snapshot()).toMatchObject({
      selectedTrackIndex: 3,
      selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
    });
    expect(state.project.clipCellSnapshots().filter((cell) => cell.clipId)).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("selecting an upper-bank Clip Cell follows the selected Track Bank without creating clips", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const clipCount = state.project.clipCellSnapshots().filter((cell) => cell.clipId).length;

    expect(
      applyIntentAndCollect(
        { kind: "select-clip-cell", coordinate: { trackIndex: 5, sceneIndex: 7 } },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(state.control.snapshot()).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 7 },
    });
    expect(state.project.clipCellSnapshots().filter((cell) => cell.clipId)).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("applies Clip Cell launch as playback state and explicit UI selection", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const clipCount = state.project.clipCellSnapshots().filter((cell) => cell.clipId).length;

    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate: { trackIndex: 2, sceneIndex: 0 } },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(state.control.snapshot()).toMatchObject({
      selectedTrackIndex: 2,
      selectedClipCell: { trackIndex: 2, sceneIndex: 0 },
    });
    expect(state.playback.snapshot().tracks[2].playingClipId).toBe("clip-3");
    expect(state.project.clipCellSnapshots().filter((cell) => cell.clipId)).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("launching an occupied upper-bank Clip Cell selects it and starts that Track", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate: { trackIndex: 4, sceneIndex: 0 } },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(state.control.snapshot()).toMatchObject({
      selectedTrackIndex: 4,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 4, sceneIndex: 0 },
    });
    expect(state.playback.snapshot().tracks[4].playingClipId).toBe("clip-5");
    expect(hostCommands).toEqual([]);
  });

  test("starting transport launches the selected clip when present", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);
    expect(state.transport.snapshot().playing).toBe(true);
    expect(state.playback.snapshot().tracks[0].playingClipId).toBe("clip-1");
    expect(hostCommands).toEqual([
      { kind: "track-note-on", route: { kind: "move", moveTrackTarget: 0 }, trackIndex: 0, note: 60, velocity: 100 },
    ]);
  });

  test("starting transport does not launch the selected Clip Cell when any Track is already playing", () => {
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

    expect(state.transport.snapshot().playing).toBe(true);
    expect(state.playback.snapshot().tracks[0].playingClipId).toBeNull();
    expect(state.playback.snapshot().tracks[2].playingClipId).toBe("clip-3");
    expect(hostCommands).toEqual([
      { kind: "track-note-on", route: { kind: "move", moveTrackTarget: 2 }, trackIndex: 2, note: 60, velocity: 100 },
    ]);
  });

  test("applies transport toggle without selected-track note-off when no clips are playing", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    state.control.selectClipCell({ trackIndex: 0, sceneIndex: 7 });

    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);
    expect(state.transport.snapshot().playing).toBe(true);
    expect(state.playback.snapshot().tracks[0].playingClipId).toBeNull();
    expect(hostCommands).toEqual([]);

    expect(applyIntentAndCollect({ kind: "toggle-transport" }, state, hostCommands)).toBe(true);
    expect(state.transport.snapshot().playing).toBe(false);
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
    state.transport.seekToStep(4);

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

    expect(state.playback.snapshot().tracks[4].playingClipId).toBeNull();
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

    state.control.selectClipCell({ trackIndex: 0, sceneIndex: 7 });

    expect(applyIntentAndCollect({ kind: "select-track", trackIndex: 5 }, state, hostCommands)).toBe(true);

    expect(state.control.snapshot()).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 7 },
    });
    expect(hostCommands).toEqual([]);
  });

  test("applies step toggles only to the selected clip sequence", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const selectedClip = state.project.clipFor(state.control.snapshot().selectedClipCell);
    const otherClip = state.project.clipFor({ trackIndex: 1, sceneIndex: 0 });
    if (!selectedClip || !otherClip) throw new Error("Expected default clips");

    expect(selectedClip.sequence.steps[1].active).toBe(false);
    expect(otherClip.sequence.steps[1].active).toBe(false);

    expect(applyIntentAndCollect({ kind: "toggle-step", stepIndex: 1 }, state, hostCommands)).toBe(true);

    expect(state.control.snapshot().selectedStep).toBe(1);
    expect(selectedClip.sequence.steps[1].active).toBe(true);
    expect(otherClip.sequence.steps[1].active).toBe(false);
    expect(hostCommands).toEqual([]);
  });

  test("applies shift state without changing selection or host commands", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(applyIntentAndCollect({ kind: "set-shift-held", held: true }, state, hostCommands)).toBe(true);

    expect(state.control.snapshot()).toMatchObject({
      shiftHeld: true,
      selectedTrackIndex: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    });
    expect(hostCommands).toEqual([]);
  });

  test("lets domain guards reject invalid track and clip-cell coordinates", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(() => applyIntentAndCollect({ kind: "select-track", trackIndex: 99 }, state, hostCommands)).toThrow(
      "Invalid Track Index 99; expected integer from 0 to 7",
    );
    expect(() =>
      applyIntentAndCollect(
        { kind: "select-clip-cell", coordinate: { trackIndex: 0, sceneIndex: 99 } },
        state,
        hostCommands,
      ),
    ).toThrow("Invalid Scene Index 99; expected integer from 0 to 7");
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
    control: createInitialControlSurfaceContext(),
    transport: createTransport(),
    playback: createPlayback(),
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
