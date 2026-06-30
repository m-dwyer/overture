import { describe, expect, test } from "vitest";
import { toggleTransportPlayback } from "../../../src/application/operations";
import type { HostCommand } from "../../../src/application/types";
import type { ProjectPlaybackReadModel } from "../../../src/state/project";

describe("Overture Next transport playback operation", () => {
  test("starts transport before starting playback at the current clock", () => {
    const events: string[] = [];
    const project = {} as ProjectPlaybackReadModel;
    const clock = { playhead: 4, tick: 48 };
    const command: HostCommand = {
      kind: "track-note-on",
      route: { kind: "move", moveTrackTarget: 0 },
      trackIndex: 0,
      note: 64,
      velocity: 100,
    };

    const result = toggleTransportPlayback({
      project,
      transport: {
        isPlaying() {
          events.push("isPlaying");
          return false;
        },
        start() {
          events.push("start");
        },
        stop() {
          events.push("unexpected-stop");
        },
        clock() {
          events.push("clock");
          return clock;
        },
      },
      playback: {
        startAt(receivedProject, receivedClock) {
          expect(receivedProject).toBe(project);
          expect(receivedClock).toBe(clock);
          events.push("startAt");
          return [command];
        },
        pauseAt() {
          events.push("unexpected-pauseAt");
          return [];
        },
      },
    });

    expect(result).toEqual({ applied: true, hostCommands: [command] });
    expect(events).toEqual(["isPlaying", "start", "clock", "startAt"]);
  });

  test("stops transport before pausing playback at the current clock", () => {
    const events: string[] = [];
    const project = {} as ProjectPlaybackReadModel;
    const clock = { playhead: 4, tick: 48 };
    const command: HostCommand = {
      kind: "track-note-off",
      route: { kind: "move", moveTrackTarget: 0 },
      trackIndex: 0,
      note: 64,
    };

    const result = toggleTransportPlayback({
      project,
      transport: {
        isPlaying() {
          events.push("isPlaying");
          return true;
        },
        start() {
          events.push("unexpected-start");
        },
        stop() {
          events.push("stop");
        },
        clock() {
          events.push("clock");
          return clock;
        },
      },
      playback: {
        startAt() {
          events.push("unexpected-startAt");
          return [];
        },
        pauseAt(receivedProject, receivedClock) {
          expect(receivedProject).toBe(project);
          expect(receivedClock).toBe(clock);
          events.push("pauseAt");
          return [command];
        },
      },
    });

    expect(result).toEqual({ applied: true, hostCommands: [command] });
    expect(events).toEqual(["isPlaying", "stop", "clock", "pauseAt"]);
  });
});
