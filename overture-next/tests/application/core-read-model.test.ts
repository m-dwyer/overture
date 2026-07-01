import { describe, expect, test } from "vitest";
import {
  buildCoreSnapshot,
  selectedSequenceLength,
} from "../../src/application/core-read-model";
import { ControlInputInterpreter } from "../../src/application/controls/control-input-interpreter";
import { createPlayback } from "../../src/application/playback";
import { createTransport } from "../../src/application/transport";
import { DEFAULT_STEP_COUNT } from "../../src/domain/sequence";
import { createInitialControlSurfaceContext } from "../../src/state/control-surface-context";
import { createDefaultProject } from "../../src/state/project";

describe("Overture Next core read model", () => {
  test("projects selected clip, playback focus, and step state from core sources", () => {
    const sources = createTestCoreSources();
    sources.transport.seekToStep(4);

    const snapshot = buildCoreSnapshot(coreReadModelSources(sources));

    expect(snapshot).toMatchObject({
      selectedTrackIndex: 0,
      trackColours: [0, 1, 2, 3, 4, 5, 6, 7],
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
      trackView: { selectedPageId: "default" },
      selectedClipId: "clip-1",
      playing: false,
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
    expect(snapshot.steps[4]).toMatchObject({
      index: 4,
      active: true,
      note: 64,
      velocity: 100,
      playhead: true,
    });
  });

  test("projects sounding notes from playback into the snapshot", () => {
    const sources = createTestCoreSources();
    sources.playback.startAt(sources.project, { playhead: 0, tick: 0 });

    const snapshot = buildCoreSnapshot(coreReadModelSources(sources));

    expect(snapshot.activeNotes).toContainEqual({
      trackIndex: 0,
      note: 60,
      velocity: 100,
    });
  });

  test("uses default inactive steps for an empty selected Clip Cell", () => {
    const sources = createTestCoreSources();
    sources.project.selectClip({ trackIndex: 0, sceneIndex: 7 });

    const readModelSources = coreReadModelSources(sources);
    const snapshot = buildCoreSnapshot(readModelSources);

    expect(snapshot.selectedClipId).toBeNull();
    expect(selectedSequenceLength(readModelSources)).toBe(DEFAULT_STEP_COUNT);
    expect(snapshot.steps).toHaveLength(DEFAULT_STEP_COUNT);
    expect(snapshot.steps[0]).toMatchObject({
      active: false,
      note: null,
      velocity: null,
      playhead: true,
    });
  });
});

function createTestCoreSources() {
  const project = createDefaultProject();
  const control = createInitialControlSurfaceContext();
  const transport = createTransport();
  const playback = createPlayback();
  const controlInputInterpreter = new ControlInputInterpreter();
  playback.seedDefaultScene(project);
  return { project, control, transport, playback, controlInputInterpreter };
}

function coreReadModelSources({
  project,
  control,
  transport,
  playback,
  controlInputInterpreter,
}: ReturnType<typeof createTestCoreSources>) {
  const controlSnapshot = control.snapshot(project.selectedClipCell());
  return {
    project,
    control: controlSnapshot,
    transport: transport.snapshot(),
    playback: playback.snapshot(),
    affordances: controlInputInterpreter.affordances(controlSnapshot),
  };
}
