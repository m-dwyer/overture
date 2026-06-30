import { describe, expect, test } from "vitest";
import { createPlayback } from "../../src/application/playback";
import { createDefaultProject } from "../../src/state/project";

describe("Overture Next playback", () => {
  test("launches occupied Clip Cells as per-track playing clip focus", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    expect(
      playback.requestClipToggle(
        project,
        { trackIndex: 2, sceneIndex: 0 },
        stoppedTiming(),
      ),
    ).toEqual([]);

    expect(playback.snapshot().tracks[2]).toMatchObject({
      playingClipId: "clip-3",
      queuedClipId: null,
    });
  });

  test("stops Track playback when toggling an empty Clip Cell", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    playback.requestClipToggle(
      project,
      { trackIndex: 4, sceneIndex: 0 },
      stoppedTiming(),
    );

    expect(
      playback.requestClipToggle(
        project,
        { trackIndex: 4, sceneIndex: 7 },
        stoppedTiming(),
      ),
    ).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 60,
      },
    ]);
    expect(playback.snapshot().tracks[4].playingClipId).toBeNull();
  });

  test("starts playback at active steps in playing clips", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    playback.requestClipToggle(
      project,
      { trackIndex: 2, sceneIndex: 0 },
      stoppedTiming(),
    );

    expect(playback.startAt(project, { playhead: 0, tick: 0 })).toEqual([
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

    playback.requestClipToggle(
      project,
      { trackIndex: 2, sceneIndex: 0 },
      stoppedTiming(),
    );
    playback.startAt(project, { playhead: 0, tick: 0 });

    for (let tick = 1; tick < 12; tick++) {
      expect(
        playback.processTransportTick(project, { injectedStep: null, tick })
          .hostCommands,
      ).toEqual([]);
    }
    expect(
      playback.processTransportTick(project, { injectedStep: null, tick: 12 })
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

  test("stops all playback and clears playing clip focus", () => {
    const project = createDefaultProject();
    const playback = createPlayback();

    playback.requestClipToggle(
      project,
      { trackIndex: 1, sceneIndex: 0 },
      stoppedTiming(),
    );

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

    playback.requestClipToggle(
      project,
      { trackIndex: 4, sceneIndex: 0 },
      stoppedTiming(),
    );

    expect(
      playback.requestTrackStop(project, 4, {
        running: false,
        clock: { playhead: 4, tick: 0 },
      }),
    ).toEqual([
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

function stoppedTiming() {
  return {
    running: false,
    clock: { playhead: 0, tick: 0 },
  };
}
