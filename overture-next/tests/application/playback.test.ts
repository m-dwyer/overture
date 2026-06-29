import { describe, expect, test } from "vitest";
import { createPlayback } from "../../src/application/playback";
import { createDefaultProject } from "../../src/state/project";

describe("Overture Next playback", () => {
  test("launches occupied Clip Cells as per-track playing clip focus", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    expect(
      playback.launchClipOnTrack(project, { trackIndex: 2, sceneIndex: 0 }),
    ).toBe("clip-3");

    expect(playback.snapshot().tracks[2]).toMatchObject({
      playingClipId: "clip-3",
      queuedClipId: null,
    });
  });

  test("leaves playing clip focus unchanged when asked to launch an empty Clip Cell", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    playback.launchClipOnTrack(project, { trackIndex: 4, sceneIndex: 0 });

    expect(
      playback.launchClipOnTrack(project, { trackIndex: 4, sceneIndex: 7 }),
    ).toBeNull();
    expect(playback.snapshot().tracks[4].playingClipId).toBe("clip-5");
  });

  test("injects note commands for active steps in playing clips", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    playback.launchClipOnTrack(project, { trackIndex: 2, sceneIndex: 0 });

    expect(playback.injectStep(project, { playhead: 0, tick: 0 })).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 2 },
        trackIndex: 2,
        note: 60,
        velocity: 100,
      },
    ]);
  });

  test("drains scheduled note-offs independently from transport advancement", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    playback.launchClipOnTrack(project, { trackIndex: 2, sceneIndex: 0 });
    playback.injectStep(project, { playhead: 0, tick: 0 });

    for (let tick = 1; tick < 12; tick++) {
      expect(
        playback.advanceTick(project, { injectedStep: null, tick })
          .hostCommands,
      ).toEqual([]);
    }
    expect(
      playback.advanceTick(project, { injectedStep: null, tick: 12 })
        .hostCommands,
    ).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 2 },
        trackIndex: 2,
        note: 60,
      },
    ]);
  });

  test("emits stop note commands for active playing clip steps", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    playback.launchClipOnTrack(project, { trackIndex: 1, sceneIndex: 0 });

    expect(playback.stopAll(project, { playhead: 4, tick: 0 })).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 1 },
        trackIndex: 1,
        note: 64,
      },
    ]);
    expect(
      playback
        .snapshot()
        .tracks.every(
          (track) =>
            track.playingClipId === null && track.queuedClipId === null,
        ),
    ).toBe(true);
  });

  test("stops one Schwung-routed playing clip and clears that track", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    playback.launchClipOnTrack(project, { trackIndex: 4, sceneIndex: 0 });

    expect(playback.stopTrack(project, 4, { playhead: 4, tick: 0 })).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 64,
      },
    ]);
    expect(playback.snapshot().tracks[4].playingClipId).toBeNull();
  });
});
