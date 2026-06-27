import { describe, expect, test } from "vitest";
import {
  advancePlayback,
  createPlaybackState,
  launchClipCellPlayback,
  startTransportPlayback,
  stopTransportPlayback,
} from "../../../overture-next/src/core/playback";
import { createDefaultProject } from "../../../overture-next/src/core/project";
import { createTransport } from "../../../overture-next/src/core/transport";

describe("Overture Next playback", () => {
  test("injects note commands for active steps in playing clips", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();
    const transport = createTransport();

    launchClipCellPlayback(project, playback, transport, { trackIndex: 2, sceneIndex: 0 });

    expect(startTransportPlayback(project, playback, transport, { trackIndex: 2, sceneIndex: 0 })).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 2 },
        trackIndex: 2,
        note: 60,
        velocity: 100,
      },
    ]);
    for (let i = 0; i < 11; i++) expect(advancePlayback(project, playback, transport).hostCommands).toEqual([]);
    expect(advancePlayback(project, playback, transport).hostCommands).toEqual([
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 2 }, trackIndex: 2, note: 60 },
    ]);
  });

  test("emits stop note commands for active playing clip steps", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();
    const transport = createTransport();

    launchClipCellPlayback(project, playback, transport, { trackIndex: 1, sceneIndex: 0 });
    transport.playing = true;
    transport.playhead = 4;

    expect(stopTransportPlayback(project, playback, transport)).toEqual([
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 1 }, trackIndex: 1, note: 64 },
    ]);
    expect(transport.playing).toBe(false);
    expect(playback.tracks.every((track) => track.playingClipId === null && track.queuedClipId === null)).toBe(true);
  });

  test("stops one Schwung-routed playing clip and clears that track", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();
    const transport = createTransport();

    launchClipCellPlayback(project, playback, transport, { trackIndex: 4, sceneIndex: 0 });
    transport.playhead = 4;

    expect(launchClipCellPlayback(project, playback, transport, { trackIndex: 4, sceneIndex: 7 })).toEqual([
      { kind: "track-note-off", route: { kind: "schwung", schwungChainIndex: 0 }, trackIndex: 4, note: 64 },
    ]);
    expect(playback.tracks[4].playingClipId).toBeNull();
  });
});
