import { describe, expect, test } from "vitest";
import { clipId } from "../../../src/domain/project";
import { createTrackPlaybackRegistry } from "../../../src/application/playback/internal/track-playback-registry";

describe("Track playback registry", () => {
  test("launches a clip immediately and clears queued changes for that Track", () => {
    const registry = createTrackPlaybackRegistry(2);

    registry.queueToggle(0, clipId("clip-queued"));
    registry.launch(0, clipId("clip-1"));

    expect(registry.snapshot().tracks[0]).toEqual({
      trackIndex: 0,
      playingClipId: clipId("clip-1"),
      queuedClipId: null,
      queuedStop: false,
    });
  });

  test("toggles the currently playing clip off immediately", () => {
    const registry = createTrackPlaybackRegistry(2);

    registry.launch(0, clipId("clip-1"));

    expect(registry.toggleNow(0, clipId("clip-1"))).toEqual({
      kind: "stopped",
    });
    expect(registry.snapshot().tracks[0]).toMatchObject({
      playingClipId: null,
      queuedClipId: null,
      queuedStop: false,
    });
  });

  test("queues replacement, queued stop, and queued stop cancellation", () => {
    const registry = createTrackPlaybackRegistry(2);

    registry.launch(0, clipId("clip-1"));
    registry.queueToggle(0, clipId("clip-2"));
    expect(registry.snapshot().tracks[0]).toMatchObject({
      playingClipId: clipId("clip-1"),
      queuedClipId: clipId("clip-2"),
      queuedStop: false,
    });

    registry.queueToggle(0, clipId("clip-1"));
    expect(registry.snapshot().tracks[0]).toMatchObject({
      playingClipId: clipId("clip-1"),
      queuedClipId: null,
      queuedStop: true,
    });

    registry.queueToggle(0, clipId("clip-1"));
    expect(registry.snapshot().tracks[0]).toMatchObject({
      playingClipId: clipId("clip-1"),
      queuedClipId: null,
      queuedStop: false,
    });
  });

  test("applies queued changes at the launch boundary", () => {
    const registry = createTrackPlaybackRegistry(2);

    registry.launch(0, clipId("clip-1"));
    registry.queueToggle(0, clipId("clip-2"));
    registry.queueStop(1);

    expect(registry.tracksWithQueuedChanges()).toEqual([
      {
        trackIndex: 0,
        playingClipId: clipId("clip-1"),
        queuedClipId: clipId("clip-2"),
        queuedStop: false,
      },
    ]);

    registry.applyQueuedChange(0);

    expect(registry.snapshot().tracks[0]).toMatchObject({
      playingClipId: clipId("clip-2"),
      queuedClipId: null,
      queuedStop: false,
    });
  });
});
