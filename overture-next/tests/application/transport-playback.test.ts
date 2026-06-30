import { describe, expect, test } from "vitest";
import { createCoreOwners } from "../../src/application/core-owners";
import {
  advanceTransportPlaybackTick,
  stopTransportPlayback,
  type TransportPlaybackContext,
} from "../../src/application/transport-playback";
import { DEFAULT_STEP_COUNT } from "../../src/domain/sequence";
import type { ProjectPlaybackReadModel } from "../../src/state/project";
import type { HostCommand } from "../../src/application/types";

describe("Overture Next transport/playback coordination", () => {
  test("advances playback through narrow transport and playback contracts", () => {
    const events: string[] = [];
    const command: HostCommand = {
      kind: "track-note-on",
      route: { kind: "move", moveTrackTarget: 0 },
      trackIndex: 0,
      note: 64,
      velocity: 100,
    };
    const transportTick = { injectedStep: 4, tick: 48 };
    const project = {} as ProjectPlaybackReadModel;
    const context: TransportPlaybackContext = {
      project,
      transport: {
        advance(stepCount) {
          events.push("advance:" + stepCount);
          return transportTick;
        },
        stop() {
          events.push("unexpected-stop");
        },
        clock() {
          events.push("unexpected-clock");
          return { playhead: 0, tick: 0 };
        },
      },
      playback: {
        processTransportTick(receivedProject, tick) {
          expect(receivedProject).toBe(project);
          expect(tick).toBe(transportTick);
          events.push("processTransportTick");
          return { injectedStep: tick.injectedStep, hostCommands: [command] };
        },
        stopAll() {
          events.push("unexpected-stopAll");
          return [];
        },
      },
    };

    expect(advanceTransportPlaybackTick(context)).toEqual([command]);
    expect(events).toEqual([
      "advance:" + DEFAULT_STEP_COUNT,
      "processTransportTick",
    ]);
  });

  test("stops transport before asking playback to stop all sound", () => {
    const events: string[] = [];
    const command: HostCommand = {
      kind: "track-note-off",
      route: { kind: "move", moveTrackTarget: 0 },
      trackIndex: 0,
      note: 60,
    };
    const clock = { playhead: 3, tick: 36 };
    const project = {} as ProjectPlaybackReadModel;
    const context: TransportPlaybackContext = {
      project,
      transport: {
        advance() {
          events.push("unexpected-advance");
          return { injectedStep: null, tick: 0 };
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
        processTransportTick() {
          events.push("unexpected-processTransportTick");
          return { injectedStep: null, hostCommands: [] };
        },
        stopAll(receivedProject, receivedClock) {
          expect(receivedProject).toBe(project);
          expect(receivedClock).toBe(clock);
          events.push("stopAll");
          return [command];
        },
      },
    };

    expect(stopTransportPlayback(context)).toEqual([command]);
    expect(events).toEqual(["stop", "clock", "stopAll"]);
  });

  test("coordinates transport advancement with playback step injection", () => {
    const owners = createCoreOwners();
    owners.transport.seekToStep(3);
    owners.transport.start();

    const hostCommands: HostCommand[] = [];
    for (let tick = 0; tick < 12; tick++)
      hostCommands.push(...advanceTransportPlaybackTick(owners));

    expect(owners.transport.clock()).toEqual({ playhead: 4, tick: 12 });
    expect(hostCommands).toHaveLength(8);
    expect(hostCommands[0]).toEqual({
      kind: "track-note-on",
      route: { kind: "move", moveTrackTarget: 0 },
      trackIndex: 0,
      note: 64,
      velocity: 100,
    });
    expect(hostCommands[4]).toEqual({
      kind: "track-note-on",
      route: { kind: "schwung", schwungChainIndex: 0 },
      trackIndex: 4,
      note: 64,
      velocity: 100,
    });
  });

  test("stops transport and returns playback note-off commands", () => {
    const owners = createCoreOwners();
    owners.transport.start();

    const hostCommands = stopTransportPlayback(owners);

    expect(owners.transport.snapshot().playing).toBe(false);
    expect(hostCommands).toHaveLength(8);
    expect(hostCommands[0]).toEqual({
      kind: "track-note-off",
      route: { kind: "move", moveTrackTarget: 0 },
      trackIndex: 0,
      note: 60,
    });
    expect(hostCommands[4]).toEqual({
      kind: "track-note-off",
      route: { kind: "schwung", schwungChainIndex: 0 },
      trackIndex: 4,
      note: 60,
    });
  });
});
