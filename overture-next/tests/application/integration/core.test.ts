import { describe, expect, test } from "vitest";
import { createOvertureCore } from "../../../src/application/core";
import type { CoreSnapshot } from "../../../src/application/types";
import {
  CLIP_CELL_COUNT,
  SCENE_COUNT,
  TRACK_COUNT,
  createTracks,
} from "../../../src/domain/project";
import { createDefaultSequence } from "../../../src/domain/sequence";
import { createDefaultProject } from "../../../src/state/project";

describe("Overture Next core", () => {
  test("starts in Session View with Scene 1 active", () => {
    const core = createOvertureCore();
    core.init();

    const snapshot = core.snapshot();
    expect(snapshot).toMatchObject({
      selectedTrackIndex: 0,
      visibleTrackBank: 0,
      activeView: "session",
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
      selectedClipId: "clip-1",
      playing: false,
      selectedStep: 0,
    });
    expect(
      snapshot.playbackTracks?.map((track) => track.playingClipId),
    ).toEqual([
      "clip-1",
      "clip-2",
      "clip-3",
      "clip-4",
      "clip-5",
      "clip-6",
      "clip-7",
      "clip-8",
    ]);
  });

  test("creates a default project with structural tracks, scenes, and clip cells", () => {
    const project = createDefaultProject();

    const cells = project.clipCellSnapshots();
    expect(cells).toHaveLength(CLIP_CELL_COUNT);
    expect(new Set(cells.map((cell) => cell.trackIndex)).size).toBe(
      TRACK_COUNT,
    );
    expect(new Set(cells.map((cell) => cell.sceneIndex)).size).toBe(
      SCENE_COUNT,
    );
    expect(project.clipCellAt({ trackIndex: 7, sceneIndex: 7 })).toMatchObject({
      trackIndex: 7,
      sceneIndex: 7,
      clipId: null,
    });
  });

  test("applies the default route template to structural tracks", () => {
    const tracks = createTracks();

    expect(tracks[0]).toMatchObject({
      index: 0,
      name: "Track 1",
      route: { kind: "move", moveTrackTarget: 0 },
    });
    expect(tracks[3]).toMatchObject({
      index: 3,
      name: "Track 4",
      route: { kind: "move", moveTrackTarget: 3 },
    });
    expect(tracks[4]).toMatchObject({
      index: 4,
      name: "Track 5",
      route: { kind: "schwung", schwungChainIndex: 0 },
    });
    expect(tracks[7]).toMatchObject({
      index: 7,
      name: "Track 8",
      route: { kind: "schwung", schwungChainIndex: 3 },
    });
  });

  test("dispatches transport, track selection, and step toggle as state changes", () => {
    const core = createOvertureCore();
    core.init();

    expect(core.dispatchControlInput({ kind: "play" })).toBe(true);
    expect(core.snapshot().playing).toBe(true);

    expect(core.dispatchControlInput({ kind: "shift", held: true })).toBe(true);
    expect(core.dispatchControlInput({ kind: "track-row", row: 1 })).toBe(true);
    expect(core.dispatchControlInput({ kind: "shift", held: false })).toBe(
      true,
    );
    expect(core.snapshot()).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 0 },
    });

    expect(core.snapshot().steps[1].active).toBe(false);
    expect(core.dispatchControlInput({ kind: "menu" })).toBe(true);
    expect(core.dispatchControlInput({ kind: "step", step: 1 })).toBe(true);
    expect(core.snapshot().steps[1]).toMatchObject({
      selected: true,
      active: true,
    });
  });

  test("uses shift as the upper track bank modifier for side buttons", () => {
    const core = createOvertureCore();
    core.init();

    core.dispatchControlInput({ kind: "shift", held: true });
    core.dispatchControlInput({ kind: "track-row", row: 0 });
    expect(core.snapshot().selectedTrackIndex).toBe(4);

    core.dispatchControlInput({ kind: "shift", held: false });
    core.dispatchControlInput({ kind: "track-row", row: 0 });

    expect(core.snapshot()).toMatchObject({
      selectedTrackIndex: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    });
  });

  test("launches Clip Cells from Session View pads without creating clips", () => {
    const core = createOvertureCore();
    core.init();
    const clipCount = countSnapshotClips(core.snapshot());

    expect(core.snapshot().activeView).toBe("session");

    expect(core.dispatchControlInput(padPress(0))).toBe(true);

    expect(core.snapshot()).toMatchObject({
      selectedTrackIndex: 3,
      selectedClipCell: { trackIndex: 3, sceneIndex: 0 },
      selectedClipId: "clip-4",
    });
    expect(countSnapshotClips(core.snapshot())).toBe(clipCount);
  });

  test("Session View pads use the visible track bank rows and stable scene columns", () => {
    const core = createOvertureCore();
    core.init();

    core.dispatchControlInput({ kind: "shift", held: true });
    core.dispatchControlInput({ kind: "track-row", row: 0 });
    core.dispatchControlInput({ kind: "shift", held: false });

    expect(core.snapshot().visibleTrackBank).toBe(1);
    expect(core.dispatchControlInput(padPress(26))).toBe(true);

    expect(core.snapshot()).toMatchObject({
      selectedTrackIndex: 4,
      selectedClipCell: { trackIndex: 4, sceneIndex: 2 },
      visibleTrackBank: 1,
      selectedClipId: null,
    });
  });

  test("auditions central pad presses in Track View", () => {
    const core = createOvertureCore();
    core.init();
    core.dispatchControlInput({ kind: "menu" });
    const selectedBefore = core.snapshot().selectedClipCell;

    expect(core.dispatchControlInput(padPress(7, 101))).toBe(true);
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 67,
        velocity: 101,
      },
    ]);
    expect(core.dispatchControlInput(padRelease(7))).toBe(true);
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 67,
      },
    ]);

    expect(core.snapshot().selectedClipCell).toEqual(selectedBefore);
  });

  test("emits Move note commands when the playhead reaches an active step", () => {
    const core = createCoreWithClearedPlayback();

    core.dispatchControlInput(padPress(24));
    core.dispatchControlInput({ kind: "menu" });
    core.dispatchControlInput({ kind: "play" });
    core.dispatchControlInput({ kind: "step", step: 1 });
    core.drainHostCommands();

    for (let i = 0; i < 12; i++) core.advancePlaybackTick();

    expect(getSnapshotPlayhead(core.snapshot())).toBe(1);
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 60,
      },
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 61,
        velocity: 100,
      },
    ]);
    for (let i = 0; i < 12; i++) core.advancePlaybackTick();
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 61,
      },
    ]);
    expect(core.drainHostCommands()).toEqual([]);
  });

  test("transport ticks emit notes from the playing clip when another Clip Cell is selected", () => {
    const core = createCoreWithClearedPlayback();

    core.dispatchControlInput(padPress(16));
    core.dispatchControlInput(padPress(16));
    core.dispatchControlInput({ kind: "menu" });
    core.dispatchControlInput({ kind: "track-row", row: 0 });
    expect(core.snapshot().selectedClipCell).toEqual({
      trackIndex: 0,
      sceneIndex: 0,
    });

    core.dispatchControlInput({ kind: "play" });
    core.drainHostCommands();
    for (let i = 0; i < 48; i++) core.advancePlaybackTick();

    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 1 },
        trackIndex: 1,
        note: 60,
      },
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 1 },
        trackIndex: 1,
        note: 64,
        velocity: 100,
      },
    ]);
    for (let i = 0; i < 12; i++) core.advancePlaybackTick();
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 1 },
        trackIndex: 1,
        note: 64,
      },
    ]);
  });

  test("Track View step editing targets the selected Clip Cell, not the playing clip", () => {
    const core = createCoreWithClearedPlayback();

    core.dispatchControlInput(padPress(16));
    core.dispatchControlInput(padPress(16));
    core.dispatchControlInput({ kind: "menu" });
    core.dispatchControlInput({ kind: "track-row", row: 0 });
    core.dispatchControlInput({ kind: "step", step: 1 });

    expect(core.snapshot()).toMatchObject({
      activeView: "track",
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    });
    expect(core.snapshot().steps[1].active).toBe(true);

    core.dispatchControlInput({ kind: "track-row", row: 1 });

    expect(core.snapshot()).toMatchObject({
      selectedClipCell: { trackIndex: 1, sceneIndex: 0 },
    });
    expect(core.snapshot().steps[1].active).toBe(false);
  });

  test("launching an Empty Clip Cell stops that Track without creating a clip", () => {
    const core = createCoreWithClearedPlayback();
    const clipCount = countSnapshotClips(core.snapshot());

    core.dispatchControlInput(padPress(0));
    core.dispatchControlInput(padPress(0));
    expect(core.snapshot()).toMatchObject({
      selectedClipCell: { trackIndex: 3, sceneIndex: 0 },
      selectedClipId: "clip-4",
    });

    core.dispatchControlInput(padPress(7));
    core.dispatchControlInput(padPress(7));

    expect(core.snapshot()).toMatchObject({
      selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
      selectedClipId: null,
    });
    expect(countSnapshotClips(core.snapshot())).toBe(clipCount);

    core.dispatchControlInput({ kind: "play" });
    core.drainHostCommands();
    for (let i = 0; i < 48; i++) core.advancePlaybackTick();
    expect(core.drainHostCommands()).toEqual([]);
  });

  test("returns a core snapshot without touching a host adapter", () => {
    const core = createOvertureCore();
    core.init();

    const snapshot = core.snapshot();
    expect(snapshot.steps.slice(0, 5)).toEqual([
      {
        index: 0,
        active: true,
        note: 60,
        velocity: 100,
        selected: true,
        playhead: true,
      },
      {
        index: 1,
        active: false,
        note: 61,
        velocity: 100,
        selected: false,
        playhead: false,
      },
      {
        index: 2,
        active: false,
        note: 62,
        velocity: 100,
        selected: false,
        playhead: false,
      },
      {
        index: 3,
        active: false,
        note: 63,
        velocity: 100,
        selected: false,
        playhead: false,
      },
      {
        index: 4,
        active: true,
        note: 64,
        velocity: 100,
        selected: false,
        playhead: false,
      },
    ]);
    expect(snapshot.selectedTrackIndex).toBe(0);
    expect(
      snapshot.clipCells.find(
        (cell) => cell.trackIndex === 0 && cell.sceneIndex === 0,
      ),
    ).toMatchObject({
      clipId: "clip-1",
    });
    expect(
      snapshot.clipCells.find(
        (cell) => cell.trackIndex === 0 && cell.sceneIndex === 7,
      ),
    ).toMatchObject({
      clipId: null,
    });
  });

  test("creates a default sequence with per-step note data", () => {
    const sequence = createDefaultSequence();

    expect(sequence.length).toBe(16);
    expect(sequence.steps[0]).toMatchObject({
      index: 0,
      active: true,
      note: 60,
      velocity: 100,
    });
    expect(sequence.steps[1]).toMatchObject({
      index: 1,
      active: false,
      note: 61,
      velocity: 100,
    });
    expect(sequence.steps[4].active).toBe(true);
  });

  test("keeps sequences owned by independent clips", () => {
    const project = createDefaultProject();
    const firstClip = project.clipFor({ trackIndex: 0, sceneIndex: 0 });
    const secondClip = project.clipFor({ trackIndex: 1, sceneIndex: 0 });

    expect(firstClip?.id).toBe("clip-1");
    expect(secondClip?.id).toBe("clip-2");
    if (!firstClip || !secondClip) throw new Error("Expected default clips");

    project.toggleSequenceStepAt({ trackIndex: 0, sceneIndex: 0 }, 1);

    expect(
      project.clipFor({ trackIndex: 0, sceneIndex: 0 })?.sequence.steps[1]
        .active,
    ).toBe(true);
    expect(secondClip.sequence.steps[1].active).toBe(false);
  });

  test("selects an empty clip cell without creating an Overture Clip", () => {
    const project = createDefaultProject();
    const occupied = project
      .clipCellSnapshots()
      .filter((cell) => cell.clipId).length;

    expect(project.clipFor({ trackIndex: 0, sceneIndex: 7 })).toBeNull();
    expect(
      project.clipCellSnapshots().filter((cell) => cell.clipId),
    ).toHaveLength(occupied);
    expect(
      project.clipCellAt({ trackIndex: 0, sceneIndex: 7 }).clipId,
    ).toBeNull();
  });

  test("wraps the transport playhead through the default playback timeline", () => {
    const core = createOvertureCore();
    core.init();

    core.dispatchControlInput({ kind: "play" });
    for (let i = 0; i < 12 * 16; i++) core.advancePlaybackTick();

    expect(getSnapshotPlayhead(core.snapshot())).toBe(0);
  });

  test("uses the playing clip sequence note when emitting Move commands", () => {
    const core = createCoreWithClearedPlayback();

    core.dispatchControlInput(padPress(24));
    core.dispatchControlInput({ kind: "menu" });
    core.dispatchControlInput({ kind: "play" });
    core.drainHostCommands();

    for (let i = 0; i < 48; i++) core.advancePlaybackTick();

    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 60,
      },
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 64,
        velocity: 100,
      },
    ]);
    for (let i = 0; i < 12; i++) core.advancePlaybackTick();
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 64,
      },
    ]);
  });

  test("launches Track 5 playback through its Schwung route and applies step edits", () => {
    const core = createCoreWithClearedPlayback();

    core.dispatchControlInput({ kind: "shift", held: true });
    core.dispatchControlInput({ kind: "track-row", row: 0 });
    core.dispatchControlInput({ kind: "shift", held: false });
    core.dispatchControlInput(padPress(24));
    core.dispatchControlInput({ kind: "menu" });

    expect(core.snapshot()).toMatchObject({
      selectedTrackIndex: 4,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 0 },
      selectedClipCell: { trackIndex: 4, sceneIndex: 0 },
      selectedClipId: "clip-5",
    });

    core.dispatchControlInput({ kind: "play" });
    core.drainHostCommands();
    for (let i = 0; i < 48; i++) core.advancePlaybackTick();

    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 60,
      },
      {
        kind: "track-note-on",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 64,
        velocity: 100,
      },
    ]);
    core.dispatchControlInput({ kind: "step", step: 5 });
    core.drainHostCommands();
    for (let i = 0; i < 12; i++) core.advancePlaybackTick();
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 64,
      },
      {
        kind: "track-note-on",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 65,
        velocity: 100,
      },
    ]);
    for (let i = 0; i < 12; i++) core.advancePlaybackTick();
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 65,
      },
    ]);
  });

  test("transport resume preserves launched clip focus after track selection changes", () => {
    const core = createCoreWithClearedPlayback();

    core.dispatchControlInput({ kind: "shift", held: true });
    core.dispatchControlInput({ kind: "track-row", row: 3 });
    core.dispatchControlInput({ kind: "shift", held: false });
    core.dispatchControlInput(padPress(0));
    core.dispatchControlInput({ kind: "menu" });
    core.dispatchControlInput({ kind: "play" });
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "schwung", schwungChainIndex: 3 },
        trackIndex: 7,
        note: 60,
        velocity: 100,
      },
    ]);

    core.dispatchControlInput({ kind: "play" });
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 3 },
        trackIndex: 7,
        note: 60,
      },
    ]);

    core.dispatchControlInput({ kind: "shift", held: true });
    core.dispatchControlInput({ kind: "track-row", row: 2 });
    core.dispatchControlInput({ kind: "shift", held: false });
    expect(core.snapshot()).toMatchObject({
      selectedTrackIndex: 6,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 2 },
      selectedClipCell: { trackIndex: 6, sceneIndex: 0 },
    });

    core.dispatchControlInput({ kind: "play" });
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "schwung", schwungChainIndex: 3 },
        trackIndex: 7,
        note: 60,
        velocity: 100,
      },
    ]);
  });

  test("transport start does not launch the selected Track View clip", () => {
    const core = createCoreWithClearedPlayback();

    core.dispatchControlInput({ kind: "shift", held: true });
    core.dispatchControlInput({ kind: "track-row", row: 0 });
    core.dispatchControlInput({ kind: "shift", held: false });
    core.dispatchControlInput({ kind: "menu" });

    expect(core.snapshot()).toMatchObject({
      activeView: "track",
      selectedTrackIndex: 4,
      selectedClipCell: { trackIndex: 4, sceneIndex: 0 },
      selectedClipId: "clip-5",
    });

    core.dispatchControlInput({ kind: "play" });
    expect(core.drainHostCommands()).toEqual([]);
    for (let i = 0; i < 48; i++) core.advancePlaybackTick();

    expect(core.drainHostCommands()).toEqual([]);
  });
});

function countSnapshotClips(snapshot: CoreSnapshot): number {
  return snapshot.clipCells.filter((cell) => cell.clipId !== null).length;
}

function createCoreWithClearedPlayback() {
  const core = createOvertureCore();
  core.init();
  core.stopPlayback();
  return core;
}

function padPress(padIndex: number, velocity = 100) {
  return { kind: "pad" as const, held: true, padIndex, velocity };
}

function padRelease(padIndex: number) {
  return { kind: "pad" as const, held: false, padIndex, velocity: 0 };
}

function getSnapshotPlayhead(snapshot: CoreSnapshot): number | undefined {
  return snapshot.steps.find((step) => step.playhead)?.index;
}
