import { describe, expect, test } from "vitest";
import {
  createPlaybackState,
  injectPlaybackStep,
  launchClipCell,
  stopPlayingClip,
  stopPlayingClips,
} from "../../../overture-next/src/core/playback";
import { createDefaultProject } from "../../../overture-next/src/core/project";
import { createTransport } from "../../../overture-next/src/core/transport";

describe("Overture Next playback", () => {
  test("injects note commands for active steps in playing clips", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();

    launchClipCell(project, playback, { trackIndex: 2, sceneIndex: 0 });

    expect(injectPlaybackStep(project, playback, 0)).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 2 },
        trackIndex: 2,
        note: 60,
        velocity: 100,
      },
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 2 }, trackIndex: 2, note: 60 },
    ]);
  });

  test("emits stop note commands for active playing clip steps", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();
    const transport = createTransport();

    launchClipCell(project, playback, { trackIndex: 1, sceneIndex: 0 });
    transport.playhead = 4;

    expect(stopPlayingClips(project, playback, transport)).toEqual([
      { kind: "track-note-off", route: { kind: "move", moveTrackTarget: 1 }, trackIndex: 1, note: 64 },
    ]);
  });

  test("stops one Schwung-routed playing clip and clears that track", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();
    const transport = createTransport();

    launchClipCell(project, playback, { trackIndex: 4, sceneIndex: 0 });
    transport.playhead = 4;

    expect(stopPlayingClip(project, playback, transport, 4)).toEqual([
      { kind: "track-note-off", route: { kind: "schwung", schwungChainIndex: 0 }, trackIndex: 4, note: 64 },
    ]);
    expect(playback.tracks[4].playingClipId).toBeNull();
  });
});
