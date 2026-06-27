import { describe, expect, test } from "vitest";
import {
  createPlaybackState,
  injectPlaybackStep,
  launchClipCell,
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
      { kind: "track-note-on", trackIndex: 2, note: 60, velocity: 100 },
      { kind: "track-note-off", trackIndex: 2, note: 60 },
    ]);
  });

  test("emits stop note commands for active playing clip steps", () => {
    const project = createDefaultProject();
    const playback = createPlaybackState();
    const transport = createTransport();

    launchClipCell(project, playback, { trackIndex: 1, sceneIndex: 0 });
    transport.playhead = 4;

    expect(stopPlayingClips(project, playback, transport)).toEqual([
      { kind: "track-note-off", trackIndex: 1, note: 64 },
    ]);
  });
});
