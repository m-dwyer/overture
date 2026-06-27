import { describe, expect, test } from "vitest";
import { createOvertureCore } from "../../../overture-next/src/core/core";
import type { CoreSnapshot } from "../../../overture-next/src/core/types";
import {
  CLIP_CELL_COUNT,
  SCENE_COUNT,
  createDefaultProject,
  getClipCell,
  getClipForCell,
} from "../../../overture-next/src/core/project";
import { createDefaultSequence } from "../../../overture-next/src/core/sequence";
import { TRACK_COUNT, createTracks } from "../../../overture-next/src/core/track";

describe("Overture Next core", () => {
  test("starts directly in the track view", () => {
    const core = createOvertureCore();
    core.init();

    const snapshot = core.getSnapshot();
    expect(snapshot).toMatchObject({
      selectedTrackIndex: 0,
      visibleTrackBank: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
      selectedClipId: "clip-1",
      playing: false,
      selectedStep: 0,
    });
  });

  test("creates a default project with structural tracks, scenes, and clip cells", () => {
    const project = createDefaultProject();

    expect(project.tracks).toHaveLength(TRACK_COUNT);
    expect(project.scenes).toHaveLength(SCENE_COUNT);
    expect(project.clipCells).toHaveLength(CLIP_CELL_COUNT);
    expect(getClipCell(project, { trackIndex: 7, sceneIndex: 7 })).toMatchObject({
      trackIndex: 7,
      sceneIndex: 7,
      clipId: null,
    });
  });

  test("applies the default route template to structural tracks", () => {
    const tracks = createTracks();

    expect(tracks[0]).toMatchObject({ index: 0, name: "Track 1", route: { kind: "move", moveTrackTarget: 0 } });
    expect(tracks[3]).toMatchObject({ index: 3, name: "Track 4", route: { kind: "move", moveTrackTarget: 3 } });
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

    expect(core.applyInput({ kind: "play" })).toBe(true);
    expect(core.getSnapshot().playing).toBe(true);

    expect(core.applyInput({ kind: "shift", held: true })).toBe(true);
    expect(core.applyInput({ kind: "track-row", row: 1 })).toBe(true);
    expect(core.applyInput({ kind: "shift", held: false })).toBe(true);
    expect(core.getSnapshot()).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 0 },
    });

    expect(core.getSnapshot().steps[1].active).toBe(false);
    expect(core.applyInput({ kind: "step", step: 1 })).toBe(true);
    expect(core.getSnapshot().steps[1]).toMatchObject({ selected: true, active: true });
  });

  test("uses shift as the upper track bank modifier for side buttons", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "shift", held: true });
    core.applyInput({ kind: "track-row", row: 0 });
    expect(core.getSnapshot().selectedTrackIndex).toBe(4);

    core.applyInput({ kind: "shift", held: false });
    core.applyInput({ kind: "track-row", row: 0 });

    expect(core.getSnapshot()).toMatchObject({
      selectedTrackIndex: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    });
  });

  test("launches Clip Cells from Session View pads without creating clips", () => {
    const core = createOvertureCore();
    core.init();
    const clipCount = countSnapshotClips(core.getSnapshot());

    core.applyInput({ kind: "menu" });
    expect(core.getSnapshot().controlMode).toBe("session");

    expect(core.applyInput({ kind: "pad", padIndex: 0 })).toBe(true);

    expect(core.getSnapshot()).toMatchObject({
      selectedTrackIndex: 3,
      selectedClipCell: { trackIndex: 3, sceneIndex: 0 },
      selectedClipId: "clip-4",
    });
    expect(countSnapshotClips(core.getSnapshot())).toBe(clipCount);
  });

  test("Session View pads use the visible track bank rows and stable scene columns", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "shift", held: true });
    core.applyInput({ kind: "track-row", row: 0 });
    core.applyInput({ kind: "shift", held: false });
    core.applyInput({ kind: "menu" });

    expect(core.getSnapshot().visibleTrackBank).toBe(1);
    expect(core.applyInput({ kind: "pad", padIndex: 26 })).toBe(true);

    expect(core.getSnapshot()).toMatchObject({
      selectedTrackIndex: 4,
      selectedClipCell: { trackIndex: 4, sceneIndex: 2 },
      visibleTrackBank: 1,
      selectedClipId: null,
    });
  });

  test("ignores central pad presses in Track View for now", () => {
    const core = createOvertureCore();
    core.init();
    const selectedBefore = core.getSnapshot().selectedClipCell;

    expect(core.applyInput({ kind: "pad", padIndex: 7 })).toBe(false);

    expect(core.getSnapshot().selectedClipCell).toEqual(selectedBefore);
  });

  test("emits Move note commands when the playhead reaches an active step", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "pad", padIndex: 24 });
    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "play" });
    core.applyInput({ kind: "step", step: 1 });
    core.drainHostCommands();

    for (let i = 0; i < 12; i++) core.tick();

    expect(getSnapshotPlayhead(core.getSnapshot())).toBe(1);
    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 61,
        velocity: 100,
      },
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 0 }, trackIndex: 0, note: 61 },
    ]);
    expect(core.drainHostCommands()).toEqual([]);
  });

  test("transport ticks emit notes from the playing clip when another Clip Cell is selected", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "pad", padIndex: 16 });
    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "track-row", row: 0 });
    expect(core.getSnapshot().selectedClipCell).toEqual({ trackIndex: 0, sceneIndex: 0 });

    core.applyInput({ kind: "play" });
    core.drainHostCommands();
    for (let i = 0; i < 48; i++) core.tick();

    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 1 },
        trackIndex: 1,
        note: 64,
        velocity: 100,
      },
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 1 }, trackIndex: 1, note: 64 },
    ]);
  });

  test("Track View step editing targets the selected Clip Cell, not the playing clip", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "pad", padIndex: 16 });
    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "track-row", row: 0 });
    core.applyInput({ kind: "step", step: 1 });

    expect(core.getSnapshot()).toMatchObject({
      controlMode: "track",
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    });
    expect(core.getSnapshot().steps[1].active).toBe(true);

    core.applyInput({ kind: "track-row", row: 1 });

    expect(core.getSnapshot()).toMatchObject({
      selectedClipCell: { trackIndex: 1, sceneIndex: 0 },
    });
    expect(core.getSnapshot().steps[1].active).toBe(false);
  });

  test("launching an Empty Clip Cell stops that Track without creating a clip", () => {
    const core = createOvertureCore();
    core.init();
    const clipCount = countSnapshotClips(core.getSnapshot());

    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "pad", padIndex: 0 });
    expect(core.getSnapshot()).toMatchObject({
      selectedClipCell: { trackIndex: 3, sceneIndex: 0 },
      selectedClipId: "clip-4",
    });

    core.applyInput({ kind: "pad", padIndex: 7 });

    expect(core.getSnapshot()).toMatchObject({
      selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
      selectedClipId: null,
    });
    expect(countSnapshotClips(core.getSnapshot())).toBe(clipCount);

    core.applyInput({ kind: "play" });
    core.drainHostCommands();
    for (let i = 0; i < 48; i++) core.tick();
    expect(core.drainHostCommands()).toEqual([]);
  });

  test("returns a core snapshot without touching a host adapter", () => {
    const core = createOvertureCore();
    core.init();

    const snapshot = core.getSnapshot();
    expect(snapshot.steps.slice(0, 5)).toEqual([
      { index: 0, active: true, note: 60, velocity: 100, selected: true, playhead: true },
      { index: 1, active: false, note: 61, velocity: 100, selected: false, playhead: false },
      { index: 2, active: false, note: 62, velocity: 100, selected: false, playhead: false },
      { index: 3, active: false, note: 63, velocity: 100, selected: false, playhead: false },
      { index: 4, active: true, note: 64, velocity: 100, selected: false, playhead: false },
    ]);
    expect(snapshot.selectedTrackIndex).toBe(0);
    expect(snapshot.clipCells.find((cell) => cell.trackIndex === 0 && cell.sceneIndex === 0)).toMatchObject({
      clipId: "clip-1",
    });
    expect(snapshot.clipCells.find((cell) => cell.trackIndex === 0 && cell.sceneIndex === 7)).toMatchObject({
      clipId: null,
    });
  });

  test("creates a default sequence with per-step note data", () => {
    const sequence = createDefaultSequence();

    expect(sequence.length).toBe(16);
    expect(sequence.steps[0]).toMatchObject({ index: 0, active: true, note: 60, velocity: 100 });
    expect(sequence.steps[1]).toMatchObject({ index: 1, active: false, note: 61, velocity: 100 });
    expect(sequence.steps[4].active).toBe(true);
  });

  test("keeps sequences owned by independent clips", () => {
    const project = createDefaultProject();
    const firstClipId = getClipCell(project, { trackIndex: 0, sceneIndex: 0 }).clipId;
    const secondClipId = getClipCell(project, { trackIndex: 1, sceneIndex: 0 }).clipId;

    expect(firstClipId).toBe("clip-1");
    expect(secondClipId).toBe("clip-2");
    if (!firstClipId || !secondClipId) throw new Error("Expected default clips");

    project.clips[firstClipId].sequence.steps[1].active = true;

    expect(project.clips[firstClipId].sequence.steps[1].active).toBe(true);
    expect(project.clips[secondClipId].sequence.steps[1].active).toBe(false);
  });

  test("selects an empty clip cell without creating an Overture Clip", () => {
    const project = createDefaultProject();
    const clipCount = Object.keys(project.clips).length;

    expect(getClipForCell(project, { trackIndex: 0, sceneIndex: 7 })).toBeNull();
    expect(Object.keys(project.clips)).toHaveLength(clipCount);
    expect(getClipCell(project, { trackIndex: 0, sceneIndex: 7 }).clipId).toBeNull();
  });

  test("wraps the transport playhead through the default playback timeline", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "play" });
    for (let i = 0; i < 12 * 16; i++) core.tick();

    expect(getSnapshotPlayhead(core.getSnapshot())).toBe(0);
  });

  test("uses the playing clip sequence note when emitting Move commands", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "pad", padIndex: 24 });
    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "play" });
    core.drainHostCommands();

    for (let i = 0; i < 48; i++) core.tick();

    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 64,
        velocity: 100,
      },
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 0 }, trackIndex: 0, note: 64 },
    ]);
  });

  test("launches Track 5 playback through its Schwung route and applies step edits", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "shift", held: true });
    core.applyInput({ kind: "track-row", row: 0 });
    core.applyInput({ kind: "shift", held: false });
    core.applyInput({ kind: "menu" });
    core.applyInput({ kind: "pad", padIndex: 24 });
    core.applyInput({ kind: "menu" });

    expect(core.getSnapshot()).toMatchObject({
      selectedTrackIndex: 4,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 0 },
      selectedClipCell: { trackIndex: 4, sceneIndex: 0 },
      selectedClipId: "clip-5",
    });

    core.applyInput({ kind: "play" });
    core.drainHostCommands();
    for (let i = 0; i < 48; i++) core.tick();

    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 64,
        velocity: 100,
      },
      { kind: "track-note-off", route: { kind: "schwung", schwungChainIndex: 0 }, trackIndex: 4, note: 64 },
    ]);

    core.applyInput({ kind: "step", step: 5 });
    core.drainHostCommands();
    for (let i = 0; i < 12; i++) core.tick();

    expect(core.drainHostCommands()).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 65,
        velocity: 100,
      },
      { kind: "track-note-off", route: { kind: "schwung", schwungChainIndex: 0 }, trackIndex: 4, note: 65 },
    ]);
  });
});

function countSnapshotClips(snapshot: CoreSnapshot): number {
  return snapshot.clipCells.filter((cell) => cell.clipId !== null).length;
}

function getSnapshotPlayhead(snapshot: CoreSnapshot): number | undefined {
  return snapshot.steps.find((step) => step.playhead)?.index;
}
