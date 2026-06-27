import { describe, expect, test } from "vitest";
import { createOvertureCore } from "../../../overture-next/src/core/core";
import {
  CLIP_CELL_COUNT,
  SCENE_COUNT,
  createDefaultProject,
  getClipCell,
  getSelectedClip,
  selectClipCell,
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
    expect(project.selectedClipCell).toEqual({ trackIndex: 0, sceneIndex: 0 });
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
    expect(core.state.transport.playing).toBe(true);

    expect(core.applyInput({ kind: "shift", held: true })).toBe(true);
    expect(core.applyInput({ kind: "track-row", row: 1 })).toBe(true);
    expect(core.applyInput({ kind: "shift", held: false })).toBe(true);
    expect(core.state.selectedTrackIndex).toBe(5);
    expect(core.state.visibleTrackBank).toBe(1);
    expect(core.state.project.selectedClipCell).toEqual({ trackIndex: 5, sceneIndex: 0 });

    const clip = getSelectedClip(core.state.project);
    expect(clip?.sequence.steps[1].active).toBe(false);
    expect(core.applyInput({ kind: "step", step: 1 })).toBe(true);
    expect(core.state.selectedStep).toBe(1);
    expect(clip?.sequence.steps[1].active).toBe(true);
  });

  test("emits Move note commands when the playhead reaches an active step", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "play" });
    core.applyInput({ kind: "step", step: 1 });
    core.drainHostCommands();

    for (let i = 0; i < 12; i++) core.tick();

    expect(core.state.transport.playhead).toBe(1);
    expect(core.drainHostCommands()).toEqual([
      { kind: "track-note-on", trackIndex: 0, note: 61, velocity: 100 },
      { kind: "track-note-off", trackIndex: 0, note: 61 },
    ]);
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

    selectClipCell(project, { trackIndex: 0, sceneIndex: 7 });

    expect(getSelectedClip(project)).toBeNull();
    expect(Object.keys(project.clips)).toHaveLength(clipCount);
    expect(getClipCell(project, { trackIndex: 0, sceneIndex: 7 }).clipId).toBeNull();
  });

  test("wraps the transport playhead through the selected clip sequence length", () => {
    const core = createOvertureCore();
    core.init();

    core.applyInput({ kind: "play" });
    for (let i = 0; i < 12 * 16; i++) core.tick();

    expect(core.state.transport.playhead).toBe(0);
  });

  test("uses the selected clip sequence note when emitting Move commands", () => {
    const core = createOvertureCore();
    core.init();

    const clip = getSelectedClip(core.state.project);
    if (!clip) throw new Error("Expected selected clip");
    clip.sequence.steps[1].note = 72;
    core.applyInput({ kind: "play" });
    core.applyInput({ kind: "step", step: 1 });
    core.drainHostCommands();

    for (let i = 0; i < 12; i++) core.tick();

    expect(core.drainHostCommands()).toEqual([
      { kind: "track-note-on", trackIndex: 0, note: 72, velocity: 100 },
      { kind: "track-note-off", trackIndex: 0, note: 72 },
    ]);
  });
});
