import { describe, expect, test } from "vitest";
import { createPlayback } from "../../src/application/playback";
import { DEFAULT_STEP_COUNT } from "../../src/domain/sequence";
import { createTransport } from "../../src/application/transport";
import { createDefaultProject } from "../../src/state/project";

describe("Overture Next playback", () => {
  test("injects note commands for active steps in playing clips", () => {
    const project = createDefaultProject();
    const playback = createPlayback();
    const transport = createTransport();

    playback.launchClipCell(project, { trackIndex: 2, sceneIndex: 0 }, transport.clock());
    transport.start();

    expect(playback.start(project, { trackIndex: 2, sceneIndex: 0 }, transport.clock())).toEqual([
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
    const playback = createPlayback();
    const transport = createTransport();

    playback.launchClipCell(project, { trackIndex: 1, sceneIndex: 0 }, transport.clock());
    transport.start();
    transport.seekToStep(4);

    transport.stop();
    expect(playback.stop(project, transport.clock())).toEqual([
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 1 }, trackIndex: 1, note: 64 },
    ]);
    expect(transport.snapshot().playing).toBe(false);
    expect(
      playback.snapshot().tracks.every((track) => track.playingClipId === null && track.queuedClipId === null),
    ).toBe(true);
  });

  test("stops one Schwung-routed playing clip and clears that track", () => {
    const project = createDefaultProject();
    const playback = createPlayback();
    const transport = createTransport();

    playback.launchClipCell(project, { trackIndex: 4, sceneIndex: 0 }, transport.clock());
    transport.seekToStep(4);

    expect(playback.launchClipCell(project, { trackIndex: 4, sceneIndex: 7 }, transport.clock())).toEqual([
      { kind: "track-note-off", route: { kind: "schwung", schwungChainIndex: 0 }, trackIndex: 4, note: 64 },
    ]);
    expect(playback.snapshot().tracks[4].playingClipId).toBeNull();
  });
});

function advancePlaybackTick(
  project: ReturnType<typeof createDefaultProject>,
  playback: ReturnType<typeof createPlayback>,
  transport: ReturnType<typeof createTransport>,
) {
  return playback.advance(project, transport.advance(DEFAULT_STEP_COUNT));
}
