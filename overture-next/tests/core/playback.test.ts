import { describe, expect, test } from "vitest";
import {
  advancePlayback,
  createPlaybackState,
  launchClipCellPlayback,
  startPlayback,
  stopPlayback,
} from "../../src/core/playback";
import { createDefaultProject } from "../../src/core/project";
import { DEFAULT_STEP_COUNT } from "../../src/core/sequence";
import {
  advanceTransport,
  createTransport,
  startTransport,
  stopTransport,
} from "../../src/core/transport";

describe("Overture Next playback", () => {
  test("injects note commands for active steps in playing clips", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();
    const transport = createTransport();

    launchClipCellPlayback(project, playback, { trackIndex: 2, sceneIndex: 0 }, transport);
    startTransport(transport);

    expect(startPlayback(project, playback, { trackIndex: 2, sceneIndex: 0 }, transport)).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 2 },
        trackIndex: 2,
        note: 60,
        velocity: 100,
      },
    ]);
    for (let i = 0; i < 11; i++) expect(advancePlaybackTick(project, playback, transport).hostCommands).toEqual([]);
    expect(advancePlaybackTick(project, playback, transport).hostCommands).toEqual([
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 2 }, trackIndex: 2, note: 60 },
    ]);
  });

  test("emits stop note commands for active playing clip steps", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();
    const transport = createTransport();

    launchClipCellPlayback(project, playback, { trackIndex: 1, sceneIndex: 0 }, transport);
    startTransport(transport);
    transport.playhead = 4;

    stopTransport(transport);
    expect(stopPlayback(project, playback, transport)).toEqual([
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 1 }, trackIndex: 1, note: 64 },
    ]);
    expect(transport.playing).toBe(false);
    expect(playback.tracks.every((track) => track.playingClipId === null && track.queuedClipId === null)).toBe(true);
  });

  test("stops one Schwung-routed playing clip and clears that track", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();
    const transport = createTransport();

    launchClipCellPlayback(project, playback, { trackIndex: 4, sceneIndex: 0 }, transport);
    transport.playhead = 4;

    expect(launchClipCellPlayback(project, playback, { trackIndex: 4, sceneIndex: 7 }, transport)).toEqual([
      { kind: "track-note-off", route: { kind: "schwung", schwungChainIndex: 0 }, trackIndex: 4, note: 64 },
    ]);
    expect(playback.tracks[4].playingClipId).toBeNull();
  });
});

function advancePlaybackTick(
  project: Parameters<typeof advancePlayback>[0],
  playback: Parameters<typeof advancePlayback>[1],
  transport: ReturnType<typeof createTransport>,
) {
  const injectedStep = advanceTransport(transport, DEFAULT_STEP_COUNT);
  return advancePlayback(project, playback, { injectedStep, tick: transport.tick });
}
