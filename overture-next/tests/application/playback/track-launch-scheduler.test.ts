import { describe, expect, test } from "vitest";
import { clipId } from "../../../src/domain/project";
import { createTrackLaunchScheduler } from "../../../src/application/playback/internal/track-launch-scheduler";

describe("Track launch scheduler", () => {
  test("launches a clip immediately and clears queued changes for that Track", () => {
    const scheduler = createTrackLaunchScheduler(2);

    scheduler.queueToggle(0, clipId("clip-queued"));
    scheduler.launchNow(0, clipId("clip-1"));

    expect(scheduler.snapshot().tracks[0]).toEqual({
      trackIndex: 0,
      playingClipId: clipId("clip-1"),
      queuedClipId: null,
      queuedStop: false,
    });
  });

  test("toggles the currently playing clip off immediately", () => {
    const scheduler = createTrackLaunchScheduler(2);

    scheduler.launchNow(0, clipId("clip-1"));

    expect(scheduler.toggleNow(0, clipId("clip-1"))).toEqual({
      kind: "stopped",
    });
    expect(scheduler.snapshot().tracks[0]).toMatchObject({
      playingClipId: null,
      queuedClipId: null,
      queuedStop: false,
    });
  });

  test("queues replacement, queued stop, and queued stop cancellation", () => {
    const scheduler = createTrackLaunchScheduler(2);

    scheduler.launchNow(0, clipId("clip-1"));
    scheduler.queueToggle(0, clipId("clip-2"));
    expect(scheduler.snapshot().tracks[0]).toMatchObject({
      playingClipId: clipId("clip-1"),
      queuedClipId: clipId("clip-2"),
      queuedStop: false,
    });

    scheduler.queueToggle(0, clipId("clip-1"));
    expect(scheduler.snapshot().tracks[0]).toMatchObject({
      playingClipId: clipId("clip-1"),
      queuedClipId: null,
      queuedStop: true,
    });

    scheduler.queueToggle(0, clipId("clip-1"));
    expect(scheduler.snapshot().tracks[0]).toMatchObject({
      playingClipId: clipId("clip-1"),
      queuedClipId: null,
      queuedStop: false,
    });
  });

  test("applies queued changes at the launch boundary", () => {
    const scheduler = createTrackLaunchScheduler(2);

    scheduler.launchNow(0, clipId("clip-1"));
    scheduler.queueToggle(0, clipId("clip-2"));
    scheduler.queueStop(1);

    expect(scheduler.tracksWithQueuedChanges()).toEqual([
      {
        trackIndex: 0,
        playingClipId: clipId("clip-1"),
        queuedClipId: clipId("clip-2"),
        queuedStop: false,
      },
    ]);

    scheduler.applyQueuedChange(0);

    expect(scheduler.snapshot().tracks[0]).toMatchObject({
      playingClipId: clipId("clip-2"),
      queuedClipId: null,
      queuedStop: false,
    });
  });
});
