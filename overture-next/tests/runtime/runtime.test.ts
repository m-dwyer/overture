import { describe, expect, test } from "vitest";
import type { HostCommand } from "../../src/application/types";
import type { OvertureHostPorts } from "../../src/ports/host-ports";
import type { ControlSurfacePort } from "../../src/ports/inbound";
import type {
  DisplayPort,
  LedPort,
  MidiPort,
  RuntimePort,
} from "../../src/ports/outbound";
import { createOvertureRuntime } from "../../src/runtime/overture-runtime";

describe("Overture Next runtime", () => {
  test("owns the boot splash while core is already in its track view", () => {
    const frames: string[][] = [];
    const frame: string[] = [];
    const adapter = createRuntimeTestAdapter(frames, frame);
    const runtime = createOvertureRuntime(adapter);

    runtime.init();

    expect(runtime.debug.core.snapshot().selectedTrackIndex).toBe(0);
    expect(runtime.isReady()).toBe(false);
    expect(runtime.isBootSplashVisible()).toBe(true);
    expect(frames[0]).not.toContain("print:OVERTURE NEXT");
    expect(frames[0]).toContain("clear");

    for (let i = 0; i < 48; i++) runtime.tick();

    expect(runtime.isBootSplashVisible()).toBe(false);
    expect(runtime.isReady()).toBe(true);
    expect(frames.at(-1)).toContain("print:OVERTURE NEXT");
  });

  test("parses host MIDI before applying domain input to core", () => {
    const frames: string[][] = [];
    const frame: string[] = [];
    const adapter = createRuntimeTestAdapter(frames, frame);
    const runtime = createOvertureRuntime(adapter);
    runtime.init();

    runtime.onMidiMessage([0xb0, 85, 127]);

    expect(runtime.debug.core.snapshot().playing).toBe(true);
  });

  test("unload emits route-safe note-off commands for active Schwung playback", () => {
    const frames: string[][] = [];
    const frame: string[] = [];
    const commandLog: HostCommand[] = [];
    const adapter = createRuntimeTestAdapter(frames, frame, commandLog);
    const runtime = createOvertureRuntime(adapter);
    runtime.init();

    runtime.debug.core.dispatchControlInput({ kind: "shift", held: true });
    runtime.debug.core.dispatchControlInput({ kind: "track-row", row: 0 });
    runtime.debug.core.dispatchControlInput({ kind: "shift", held: false });
    runtime.debug.core.dispatchControlInput({ kind: "menu" });
    runtime.debug.core.dispatchControlInput(padPress(24));
    runtime.debug.core.dispatchControlInput({ kind: "menu" });
    runtime.debug.core.dispatchControlInput({ kind: "play" });
    for (let i = 0; i < 48; i++) runtime.tick();
    commandLog.length = 0;

    runtime.onUnload();

    expect(commandLog).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 64,
      },
    ]);
  });

  test("can advance playback and drain commands without rendering", () => {
    const frames: string[][] = [];
    const frame: string[] = [];
    const commands: HostCommand[] = [];
    const adapter = createRuntimeTestAdapter(frames, frame, commands);
    const runtime = createOvertureRuntime(adapter);
    runtime.init();
    const renderedFrameCount = frames.length;

    runtime.debug.core.dispatchControlInput({ kind: "menu" });
    runtime.debug.core.dispatchControlInput(padPress(24));
    runtime.debug.core.dispatchControlInput({ kind: "menu" });
    runtime.debug.core.dispatchControlInput({ kind: "play" });

    for (let i = 0; i < 48; i++) runtime.tickPlayback();

    expect(frames).toHaveLength(renderedFrameCount);
    expect(commands).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 60,
        velocity: 100,
      },
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 60,
      },
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 64,
        velocity: 100,
      },
    ]);
    for (let i = 0; i < 12; i++) runtime.tickPlayback();
    expect(commands).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 60,
        velocity: 100,
      },
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 60,
      },
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 64,
        velocity: 100,
      },
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 64,
      },
    ]);

    runtime.render();

    expect(frames).toHaveLength(renderedFrameCount + 1);
  });
});

function createRuntimeTestAdapter(
  frames: string[][],
  frame: string[],
  commandLog: HostCommand[] = [],
): OvertureHostPorts {
  const runtime: RuntimePort = {
    publishState() {},
  };
  const display: DisplayPort = {
    splashSurface: {
      clear: () => {
        frame.push("clear");
      },
      fillRect: () => {
        frame.push("fill");
      },
    },
    clear() {
      frame.push("clear");
    },
    print(_x, _y, text) {
      frame.push("print:" + text);
    },
    rect() {
      frame.push("rect");
    },
    flush() {
      frames.push([...frame]);
      frame.length = 0;
    },
  };
  const leds: LedPort = {
    setStepLed() {},
    setPadLed() {},
    setTrackRowLed() {},
    setPlayLed() {},
    setMenuLed() {},
  };
  const controlSurface: ControlSurfacePort = {
    parseMoveInput(data) {
      return data[0] === 0xb0 && data[1] === 85 && data[2] > 0
        ? { kind: "play" }
        : null;
    },
  };
  const midi: MidiPort = {
    sendMovePacket() {},
    sendSchwungMessage() {},
  };
  const commands = {
    execute(command: HostCommand) {
      commandLog.push(command);
    },
  };
  return {
    inbound: { controlSurface },
    outbound: { runtime, display, leds, midi, commands },
  };
}

function padPress(padIndex: number) {
  return { kind: "pad" as const, held: true, padIndex, velocity: 100 };
}
