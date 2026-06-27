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

    expect(runtime.core.getSnapshot().selectedTrackIndex).toBe(0);
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

    expect(runtime.core.getSnapshot().playing).toBe(true);
  });

  test("unload emits route-safe note-off commands for active Schwung playback", () => {
    const frames: string[][] = [];
    const frame: string[] = [];
    const commandLog: HostCommand[] = [];
    const adapter = createRuntimeTestAdapter(frames, frame, commandLog);
    const runtime = createOvertureRuntime(adapter);
    runtime.init();

    runtime.core.applyInput({ kind: "shift", held: true });
    runtime.core.applyInput({ kind: "track-row", row: 0 });
    runtime.core.applyInput({ kind: "shift", held: false });
    runtime.core.applyInput({ kind: "menu" });
    runtime.core.applyInput({ kind: "pad", padIndex: 24 });
    runtime.core.applyInput({ kind: "menu" });
    runtime.core.applyInput({ kind: "play" });
    for (let i = 0; i < 48; i++) runtime.tick();
    commandLog.length = 0;

    runtime.onUnload();

    expect(commandLog).toEqual([
      { kind: "track-note-off", route: { kind: "schwung", schwungChainIndex: 0 }, trackIndex: 4, note: 64 },
    ]);
  });
});

function createRuntimeTestAdapter(
  frames: string[][],
  frame: string[],
  commandLog: HostCommand[] = [],
): OvertureHostAdapter {
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
  const input: InputPort = {
    parseMoveInput(data) {
      return data[0] === 0xb0 && data[1] === 85 && data[2] > 0 ? { kind: "play" } : null;
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
  return { runtime, display, leds, input, midi, commands };
}
