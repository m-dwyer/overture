import { describe, expect, test } from "vitest";
import { CC, NAV, NOTE_OFF, NOTE_ON, ROW_CC } from "../../src/lib/move-controls";
import { scheduleInitialState, type InitialStateDriverPort, type OvertureUiStateSnapshot } from "../../src/host/initial-state-driver";
import type { Emulator } from "../../src/host/emulator";
import { createMockDsp } from "../../src/mock-dsp";

describe("initial-state driver", () => {
  test("selects an initial track through control-surface MIDI after runtime settles", () => {
    const emu = createRecorderEmulator();
    const port = createManualPort({ selectedTrackIndex: 0, sessionView: false });

    scheduleInitialState(emu, { trackNumber: 5, view: null }, port);
    port.fire();

    expect(emu.calls).toEqual([
      [CC, NAV.Shift, 127],
      [CC, ROW_CC[0], 127],
      [CC, ROW_CC[0], 0],
      [CC, NAV.Shift, 0],
    ]);
    expect(port.cleared).toBe(1);
  });

  test("uses session pads for initial track selection when Overture is in session view", () => {
    const emu = createRecorderEmulator();
    const port = createManualPort({ selectedTrackIndex: 0, sessionView: true });

    scheduleInitialState(emu, { trackNumber: 5, view: "note" }, port);
    port.fire();

    expect(emu.calls).toEqual([
      [NOTE_ON, 96, 110],
      [NOTE_OFF, 96, 0],
      [CC, NAV.Menu, 127],
      [CC, NAV.Menu, 0],
    ]);
    expect(port.cleared).toBe(1);
  });
});

function createManualPort(state: OvertureUiStateSnapshot): InitialStateDriverPort & { cleared: number; fire(): void } {
  let callback: (() => void) | null = null;
  return {
    cleared: 0,
    clearInterval() {
      this.cleared++;
    },
    fire() {
      if (!callback) throw new Error("interval was not scheduled");
      callback();
    },
    readOvertureRuntime() {
      return { isReady: () => true };
    },
    readOvertureUiState() {
      return state;
    },
    setInterval(nextCallback) {
      callback = nextCallback;
      return "timer";
    },
  };
}

function createRecorderEmulator(): Emulator & { calls: number[][] } {
  const calls: number[][] = [];
  return {
    calls,
    dsp: createMockDsp(),
    init() {},
    tick() {},
    renderBlocks() {},
    sendExternal() {},
    sendInternal(status, data1, data2) {
      calls.push([status, data1, data2]);
    },
  };
}
