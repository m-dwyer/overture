import { describe, expect, test } from "vitest";
import { createMockDsp } from "../../src/mock-dsp";
import type { Emulator } from "../../src/host/emulator";
import { createGlobalOvtHarnessPort, createOvtHarnessHandle } from "../../src/host/emulator-harness";

describe("emulator harness port", () => {
  test("publishes and clears the global OVT harness handle", () => {
    const target = {} as typeof globalThis;
    const port = createGlobalOvtHarnessPort(target);
    const handle = createOvtHarnessHandle({
      emu: createRecorderEmulator(),
      dsp: createMockDsp(),
      leds: new Map(),
      buttonLeds: new Map(),
    });

    port.publish(handle);
    expect(target.OVT).toBe(handle);

    port.clear();
    expect(target.OVT).toBeUndefined();
  });

  test("drives inbound MIDI and deterministic ticks through the emulator boundary", () => {
    const emu = createRecorderEmulator();
    const handle = createOvtHarnessHandle({
      emu,
      dsp: createMockDsp(),
      leds: new Map(),
      buttonLeds: new Map(),
    });

    handle.midiIn(0xb0, 85, 127);
    handle.midiExt(0x90, 60, 100);
    handle.advanceTicks(2);

    expect(emu.calls).toEqual([
      ["internal", 0xb0, 85, 127],
      ["external", 0x90, 60, 100],
      ["render", 4],
      ["tick"],
      ["render", 4],
      ["tick"],
    ]);
  });
});

function createRecorderEmulator(): Emulator & { calls: unknown[][] } {
  const dsp = createMockDsp();
  const calls: unknown[][] = [];
  return {
    calls,
    dsp,
    init() {
      calls.push(["init"]);
    },
    tick() {
      calls.push(["tick"]);
    },
    renderBlocks(n) {
      calls.push(["render", n]);
    },
    sendInternal(status, data1, data2) {
      calls.push(["internal", status, data1, data2]);
    },
    sendExternal(status, data1, data2) {
      calls.push(["external", status, data1, data2]);
    },
  };
}
