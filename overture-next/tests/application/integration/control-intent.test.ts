import { describe, expect, test } from "vitest";
import { clipCellCoordinate } from "../../../src/domain/project";
import {
  createInitialControlSurfaceContext,
  DEFAULT_TRACK_VIEW_PAGE_ID,
  TRACK_VIEW_SOUND_PAGE_ID,
} from "../../../src/state/control-surface-context";
import { interpretControl } from "../../../src/application/controls/interpret-control";
import { applyCoreIntent } from "../../../src/application/intents/apply-core-intent";
import type {
  DomainIntent,
  DomainIntentTransaction,
} from "../../../src/application/intents/types";
import { createPlayback } from "../../../src/application/playback";
import { createDefaultProject } from "../../../src/state/project";
import { createTransport } from "../../../src/application/transport";
import type { HostCommand } from "../../../src/application/types";
import type { ClipCellCoordinateInput } from "../../../src/domain/project";

interface TestCoreState {
  readonly control: ReturnType<typeof createInitialControlSurfaceContext>;
  readonly transport: ReturnType<typeof createTransport>;
  readonly playback: ReturnType<typeof createPlayback>;
  readonly project: ReturnType<typeof createDefaultProject>;
}

describe("Overture Next control-to-intent pipeline", () => {
  test("interprets track rows against the current shift modifier", () => {
    const lowerBankControl = createInitialControlSurfaceContext();
    const upperBankControl = createInitialControlSurfaceContext();
    upperBankControl.setSurfaceControlHeld("shift", true);

    expect(
      interpretControl(
        { kind: "track-row", row: 1 },
        lowerBankControl.snapshot(
          clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 }),
        ),
      ),
    ).toEqual({
      kind: "select-track",
      trackIndex: 1,
    });

    expect(
      interpretControl(
        { kind: "track-row", row: 1 },
        upperBankControl.snapshot(
          clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 }),
        ),
      ),
    ).toEqual({
      kind: "select-track",
      trackIndex: 5,
    });
  });

  test("interprets Track View central pads as selected-track note audition", () => {
    const control = createInitialControlSurfaceContext();
    control.toggleActiveView();

    expect(
      interpretControl(
        padPress(7, 101),
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      kind: "audition-note",
      held: true,
      padIndex: 7,
      note: 67,
      trackIndex: 0,
      velocity: 101,
    });
    expect(
      interpretControl(
        padRelease(7),
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      kind: "audition-note",
      held: false,
      padIndex: 7,
      note: 67,
      trackIndex: 0,
      velocity: 0,
    });
  });

  test("interprets Session View pads as Clip Cell launch without leaking pad indexes", () => {
    const control = createInitialControlSurfaceContext();

    const intent = interpretControl(
      padPress(26),
      control.snapshot(clipCellCoordinate({ trackIndex: 4, sceneIndex: 0 })),
    );

    expect(intent).toEqual({
      kind: "launch-clip-cell",
      coordinate: { trackIndex: 4, sceneIndex: 2 },
    });
    expect(intent).not.toHaveProperty("padIndex");
  });

  test("falls through from global controls to the active view context", () => {
    const control = createInitialControlSurfaceContext();

    expect(
      interpretControl(
        { kind: "step", step: 1 },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toBeNull();

    control.toggleActiveView();

    expect(
      interpretControl(
        { kind: "step", step: 1 },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      kind: "toggle-step",
      stepIndex: 1,
    });
    expect(
      interpretControl(
        { kind: "play" },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      kind: "toggle-transport-playback",
    });
  });

  test("toggles the Track View Sound page from Shift plus Step 3", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    state.control.toggleActiveView();
    state.control.setSurfaceControlHeld("shift", true);

    const intent = interpretControl(
      { kind: "step", step: 2 },
      state.control.snapshot(state.project.selectedClipCell()),
    );

    expect(intent).toEqual({
      kind: "select-track-view-page",
      pageId: TRACK_VIEW_SOUND_PAGE_ID,
    });
    if (!intent) throw new Error("Expected Sound page intent");
    expect(applyIntentAndCollect(intent, state, hostCommands)).toBe(true);
    expect(
      state.control.snapshot(state.project.selectedClipCell()).trackView
        .selectedPageId,
    ).toBe(TRACK_VIEW_SOUND_PAGE_ID);
    expect(hostCommands).toEqual([]);

    const closeIntent = interpretControl(
      { kind: "step", step: 2 },
      state.control.snapshot(state.project.selectedClipCell()),
    );

    expect(closeIntent).toEqual({
      kind: "select-track-view-page",
      pageId: DEFAULT_TRACK_VIEW_PAGE_ID,
    });
    if (!closeIntent) throw new Error("Expected default page intent");
    expect(applyIntentAndCollect(closeIntent, state, hostCommands)).toBe(true);
    expect(
      state.control.snapshot(state.project.selectedClipCell()).trackView
        .selectedPageId,
    ).toBe(DEFAULT_TRACK_VIEW_PAGE_ID);
    expect(hostCommands).toEqual([]);
  });

  test("applies clip-cell selection without creating clips", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const clipCount = state.project
      .clipCellSnapshots()
      .filter((cell) => cell.clipId).length;

    expect(
      applyIntentAndCollect(
        {
          kind: "select-clip-cell",
          coordinate: { trackIndex: 3, sceneIndex: 7 },
        },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(
      state.control.snapshot(state.project.selectedClipCell()),
    ).toMatchObject({
      selectedTrackIndex: 3,
      selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
    });
    expect(
      state.project.clipCellSnapshots().filter((cell) => cell.clipId),
    ).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("selecting an upper-bank Clip Cell follows the selected Track Bank without creating clips", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const clipCount = state.project
      .clipCellSnapshots()
      .filter((cell) => cell.clipId).length;

    expect(
      applyIntentAndCollect(
        {
          kind: "select-clip-cell",
          coordinate: { trackIndex: 5, sceneIndex: 7 },
        },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(
      state.control.snapshot(state.project.selectedClipCell()),
    ).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 7 },
    });
    expect(
      state.project.clipCellSnapshots().filter((cell) => cell.clipId),
    ).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("selects a different Clip Cell without changing playback", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const clipCount = state.project
      .clipCellSnapshots()
      .filter((cell) => cell.clipId).length;

    expect(
      applyIntentAndCollect(
        {
          kind: "launch-clip-cell",
          coordinate: { trackIndex: 2, sceneIndex: 0 },
        },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(
      state.control.snapshot(state.project.selectedClipCell()),
    ).toMatchObject({
      selectedTrackIndex: 2,
      selectedClipCell: { trackIndex: 2, sceneIndex: 0 },
    });
    expect(state.playback.snapshot().tracks[2].playingClipId).toBeNull();
    expect(
      state.project.clipCellSnapshots().filter((cell) => cell.clipId),
    ).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("pressing the selected occupied Clip Cell starts that Track", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 4,
      sceneIndex: 0,
    });

    expect(
      state.control.snapshot(state.project.selectedClipCell()),
    ).toMatchObject({
      selectedTrackIndex: 4,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 4, sceneIndex: 0 },
    });
    expect(state.playback.snapshot().tracks[4].playingClipId).toBe("clip-5");
    expect(hostCommands).toEqual([]);
  });

  test("starting transport starts timing without launching the selected clip", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(state.transport.snapshot().playing).toBe(true);
    expect(state.playback.snapshot().tracks[0].playingClipId).toBeNull();
    expect(hostCommands).toEqual([]);
  });

  test("starting transport injects only previously launched Clips", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 2,
      sceneIndex: 0,
    });
    expect(
      applyIntentAndCollect(
        {
          kind: "select-clip-cell",
          coordinate: { trackIndex: 0, sceneIndex: 0 },
        },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(state.transport.snapshot().playing).toBe(true);
    expect(state.playback.snapshot().tracks[0].playingClipId).toBeNull();
    expect(state.playback.snapshot().tracks[2].playingClipId).toBe("clip-3");
    expect(hostCommands).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 2 },
        trackIndex: 2,
        note: 60,
        velocity: 100,
      },
    ]);
  });

  test("launching a Clip Cell while transport is running queues it for the next step", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 7,
      sceneIndex: 0,
    });
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);
    hostCommands.length = 0;

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 6,
      sceneIndex: 0,
    });

    expect(state.playback.snapshot().tracks[6]).toMatchObject({
      playingClipId: null,
      queuedClipId: "clip-7",
      queuedStop: false,
    });
    expect(hostCommands).toEqual([]);

    state.playback.processTransportTick(state.project, {
      injectedStep: 1,
      tick: 12,
    });

    expect(state.playback.snapshot().tracks[6]).toMatchObject({
      playingClipId: "clip-7",
      queuedClipId: null,
      queuedStop: false,
    });
  });

  test("launching an Empty Clip Cell while transport is running queues a Track stop", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 7,
      sceneIndex: 0,
    });
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);
    hostCommands.length = 0;

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 7,
      sceneIndex: 7,
    });

    expect(state.playback.snapshot().tracks[7]).toMatchObject({
      playingClipId: "clip-8",
      queuedClipId: null,
      queuedStop: true,
    });
    expect(hostCommands).toEqual([]);

    const advance = state.playback.processTransportTick(state.project, {
      injectedStep: 1,
      tick: 12,
    });

    expect(advance.hostCommands).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 3 },
        trackIndex: 7,
        note: 60,
      },
    ]);
    expect(state.playback.snapshot().tracks[7]).toMatchObject({
      playingClipId: null,
      queuedClipId: null,
      queuedStop: false,
    });
  });

  test("stopping transport silences but preserves launched Clips for resume", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 7,
      sceneIndex: 0,
    });
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);
    hostCommands.length = 0;
    expect(
      applyIntentAndCollect(
        {
          kind: "select-track",
          trackIndex: 6,
        },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(state.playback.snapshot().tracks[6].playingClipId).toBeNull();
    expect(state.playback.snapshot().tracks[7].playingClipId).toBe("clip-8");
    expect(hostCommands).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 3 },
        trackIndex: 7,
        note: 60,
      },
      {
        kind: "track-note-on",
        route: { kind: "schwung", schwungChainIndex: 3 },
        trackIndex: 7,
        note: 60,
        velocity: 100,
      },
    ]);
  });

  test("pauses transport playback without selected-track note-off when no clips are playing", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    state.project.selectClip({ trackIndex: 0, sceneIndex: 7 });

    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(state.transport.snapshot().playing).toBe(true);
    expect(state.playback.snapshot().tracks[0].playingClipId).toBeNull();
    expect(hostCommands).toEqual([]);

    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(state.transport.snapshot().playing).toBe(false);
    expect(hostCommands).toEqual([]);
  });

  test("pausing transport playback emits note-off for playing clips, not the selected Clip Cell", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 2,
      sceneIndex: 0,
    });
    expect(
      applyIntentAndCollect(
        {
          kind: "select-clip-cell",
          coordinate: { trackIndex: 0, sceneIndex: 0 },
        },
        state,
        hostCommands,
      ),
    ).toBe(true);
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);
    hostCommands.length = 0;
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(hostCommands).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 2 },
        trackIndex: 2,
        note: 60,
      },
    ]);
  });

  test("stopping transport emits note-off for Schwung-routed playing clips", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 4,
      sceneIndex: 0,
    });
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);
    hostCommands.length = 0;
    expect(
      applyIntentAndCollect(
        { kind: "toggle-transport-playback" },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(hostCommands).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 60,
      },
    ]);
  });

  test("launching an empty Schwung Clip Cell stops that Track via its route", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    state.transport.seekToStep(4);

    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 4,
      sceneIndex: 0,
    });
    activateClipCellViaLaunchIntent(state, hostCommands, {
      trackIndex: 4,
      sceneIndex: 7,
    });

    expect(state.playback.snapshot().tracks[4].playingClipId).toBeNull();
    expect(hostCommands).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 64,
      },
    ]);
  });

  test("returns emitted host commands as a Domain Intent transaction", () => {
    const state = createTestCoreState();

    expect(
      applyIntentWithState(
        {
          kind: "launch-clip-cell",
          coordinate: { trackIndex: 2, sceneIndex: 0 },
        },
        state,
      ),
    ).toEqual({
      applied: true,
      hostCommands: [],
    });
    expect(
      applyIntentWithState(
        {
          kind: "launch-clip-cell",
          coordinate: { trackIndex: 2, sceneIndex: 0 },
        },
        state,
      ),
    ).toEqual({
      applied: true,
      hostCommands: [],
    });
    expect(
      applyIntentWithState({ kind: "toggle-transport-playback" }, state),
    ).toEqual({
      applied: true,
      hostCommands: [
        {
          kind: "track-note-on",
          route: { kind: "move", moveTrackTarget: 2 },
          trackIndex: 2,
          note: 60,
          velocity: 100,
        },
      ],
    });

    expect(
      applyIntentWithState({ kind: "toggle-transport-playback" }, state),
    ).toEqual({
      applied: true,
      hostCommands: [
        {
          kind: "track-note-off",
          route: { kind: "move", moveTrackTarget: 2 },
          trackIndex: 2,
          note: 60,
        },
      ],
    });
  });

  test("applies track selection while preserving the selected scene", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    state.project.selectClip({ trackIndex: 0, sceneIndex: 7 });

    expect(
      applyIntentAndCollect(
        { kind: "select-track", trackIndex: 5 },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(
      state.control.snapshot(state.project.selectedClipCell()),
    ).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 7 },
    });
    expect(hostCommands).toEqual([]);
  });

  test("applies step toggles only to the selected clip sequence", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];
    const selectedClip = state.project.clipFor(
      state.project.selectedClipCell(),
    );
    const otherClip = state.project.clipFor({ trackIndex: 1, sceneIndex: 0 });
    if (!selectedClip || !otherClip) throw new Error("Expected default clips");

    expect(selectedClip.sequence.steps[1].active).toBe(false);
    expect(otherClip.sequence.steps[1].active).toBe(false);

    expect(
      applyIntentAndCollect(
        { kind: "toggle-step", stepIndex: 1 },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(
      state.project.clipFor(state.project.selectedClipCell())?.sequence.steps[1]
        .active,
    ).toBe(true);
    expect(otherClip.sequence.steps[1].active).toBe(false);
    expect(hostCommands).toEqual([]);
  });

  test("applies held physical control state without changing selection or host commands", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(
      applyIntentAndCollect(
        { kind: "set-surface-control-held", control: "shift", held: true },
        state,
        hostCommands,
      ),
    ).toBe(true);

    expect(
      state.control.snapshot(state.project.selectedClipCell()),
    ).toMatchObject({
      heldControls: ["shift"],
      selectedTrackIndex: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    });
    expect(hostCommands).toEqual([]);
  });

  test("lets domain guards reject invalid track and clip-cell coordinates", () => {
    const state = createTestCoreState();
    const hostCommands: HostCommand[] = [];

    expect(() =>
      applyIntentAndCollect(
        { kind: "select-track", trackIndex: 99 },
        state,
        hostCommands,
      ),
    ).toThrow("Invalid Track Index 99; expected integer from 0 to 7");
    expect(() =>
      applyIntentAndCollect(
        {
          kind: "select-clip-cell",
          coordinate: { trackIndex: 0, sceneIndex: 99 },
        },
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

function createTestCoreState(): TestCoreState {
  return {
    control: createInitialControlSurfaceContext(),
    transport: createTransport(),
    playback: createPlayback(),
    project: createDefaultProject(),
  };
}

function applyIntentWithState(
  intent: DomainIntent,
  state: TestCoreState,
): DomainIntentTransaction {
  return applyCoreIntent(intent, state);
}

function applyIntentAndCollect(
  intent: DomainIntent,
  state: TestCoreState,
  hostCommands: HostCommand[],
): boolean {
  const transaction = applyIntentWithState(intent, state);
  hostCommands.push(...transaction.hostCommands);
  return transaction.applied;
}

function activateClipCellViaLaunchIntent(
  state: TestCoreState,
  hostCommands: HostCommand[],
  coordinate: ClipCellCoordinateInput,
): void {
  const selected = state.project.selectedClipCell();
  const alreadySelected =
    selected.trackIndex === coordinate.trackIndex &&
    selected.sceneIndex === coordinate.sceneIndex;
  if (!alreadySelected)
    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate },
        state,
        hostCommands,
      ),
    ).toBe(true);
  expect(
    applyIntentAndCollect(
      { kind: "launch-clip-cell", coordinate },
      state,
      hostCommands,
    ),
  ).toBe(true);
}
