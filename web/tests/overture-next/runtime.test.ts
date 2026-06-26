import { describe, expect, test } from "vitest";
import type { HostCommand } from "../../../overture-next/src/core/types";
import type { InputPort, MidiPort, OvertureHostAdapter } from "../../../overture-next/src/host/types";
import type { DisplayPort, LedPort, RuntimePort } from "../../../overture-next/src/ports/types";
import { createOvertureRuntime } from "../../../overture-next/src/runtime/overture-runtime";

describe("Overture Next runtime", () => {
  test("owns the boot splash while core is already in its track view", () => {
    const frames: string[][] = [];
    const frame: string[] = [];
    const adapter = createRuntimeTestAdapter(frames, frame);
    const runtime = createOvertureRuntime(adapter);

    runtime.init();

    expect(runtime.core.getView().screen.kind).toBe("track");
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

    expect(runtime.core.state.transport.playing).toBe(true);
  });
});

function createRuntimeTestAdapter(frames: string[][], frame: string[]): OvertureHostAdapter {
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
    setTrackRowLed() {},
    setPlayLed() {},
    setMenuLed() {},
  };
  const input: InputPort = {
    parseMoveInput(data) {
      return data[0] === 0xb0 && data[1] === 85 && data[2] > 0 ? { kind: "play" } : null;
    },
  };
  const midi: MidiPort = {
    sendMovePacket() {},
  };
  const commands = {
    execute(_command: HostCommand) {},
  };
  return { runtime, display, leds, input, midi, commands };
}
