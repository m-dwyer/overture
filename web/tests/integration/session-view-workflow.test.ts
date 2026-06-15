import { beforeEach, describe, expect, test } from "vitest";
import { createHarness, type Harness, type UiState } from "./harness.js";

type PendingParam = { key: string; val: string };

interface SessionUiState extends UiState {
  deleteHeld: boolean;
  muteHeld: boolean;
  shiftHeld: boolean;
  loopHeld: boolean;
  perfViewLocked: boolean;
  perfSnapshots: number[];
  perfRecalledSlot: number;
  perfModsToggled: number;
  pendingSceneBakePicker: boolean;
  confirmBakeScene: boolean;
  confirmBakeSceneSel: number;
  confirmBakeSceneClip: number;
  pendingMergePlacement: boolean;
  pendingDefaultSetParams: PendingParam[];
  stepBtnPressedTick: number[];
  sessionStepHeld: number;
  sessionStepHeldCtx: number;
  snapshots: Array<{ mute: boolean[]; solo: boolean[]; drumEffMute?: number[] } | null>;
  trackMuted: boolean[];
  trackSoloed: boolean[];
  drumLaneMute: number[];
  drumLaneSolo: number[];
  metronomeOn: number;
}

function pressStep(h: Harness, idx: number): void {
  h.emu.sendInternal(0x90, 16 + idx, 127);
}

function releaseStep(h: Harness, idx: number): void {
  h.emu.sendInternal(0x80, 16 + idx, 0);
}

function resetSessionState(ui: SessionUiState): void {
  ui.sessionView = true;
  ui.deleteHeld = false;
  ui.muteHeld = false;
  ui.shiftHeld = false;
  ui.loopHeld = false;
  ui.perfViewLocked = false;
  ui.pendingSceneBakePicker = false;
  ui.pendingMergePlacement = false;
  ui.confirmBakeScene = false;
  ui.confirmBakeSceneSel = -1;
  ui.confirmBakeSceneClip = -1;
  ui.pendingDefaultSetParams = [];
  ui.sessionStepHeld = -1;
  ui.sessionStepHeldCtx = 0;
  ui.stepBtnPressedTick.fill(-1);
}

describe("Session View Workflow - step buttons", () => {
  let h: Harness;
  let ui: SessionUiState;

  beforeEach(async () => {
    h = await createHarness();
    ui = h.ui() as SessionUiState;
    resetSessionState(ui);
  }, 60_000);

  test("Delete+step clears perf preset when perf view is active", () => {
    ui.deleteHeld = true;
    ui.perfViewLocked = true;
    ui.perfSnapshots[3] = 42;
    ui.perfRecalledSlot = 3;
    ui.perfModsToggled = 42;

    pressStep(h, 3);

    expect(ui.perfSnapshots[3]).toBe(0);
    expect(ui.perfRecalledSlot).toBe(-1);
    expect(ui.perfModsToggled).toBe(0);
    expect(ui.pendingDefaultSetParams).toEqual([]);
  });

  test("Delete+Mute+step clears mute snapshot slot", () => {
    ui.deleteHeld = true;
    ui.muteHeld = true;
    ui.snapshots[4] = { mute: ui.trackMuted.slice(), solo: ui.trackSoloed.slice() };

    pressStep(h, 4);

    expect(ui.snapshots[4]).toBeNull();
    expect(ui.pendingDefaultSetParams).toEqual([{ key: "snap_delete", val: "4" }]);
  });

  test("Perf Mode step press and release recalls and toggles performance presets", () => {
    ui.perfViewLocked = true;
    ui.perfSnapshots[2] = 7;

    pressStep(h, 2);
    expect(ui.sessionStepHeld).toBe(2);
    expect(ui.sessionStepHeldCtx).toBe(1);

    releaseStep(h, 2);
    expect(ui.perfRecalledSlot).toBe(2);
    expect(ui.perfModsToggled).toBe(7);

    pressStep(h, 2);
    releaseStep(h, 2);
    expect(ui.perfRecalledSlot).toBe(-1);
    expect(ui.perfModsToggled).toBe(0);
  });

  test("pendingSceneBakePicker step opens scene bake confirm with selected scene", () => {
    ui.pendingSceneBakePicker = true;

    pressStep(h, 6);

    expect(ui.pendingSceneBakePicker).toBe(false);
    expect(ui.confirmBakeScene).toBe(true);
    expect(ui.confirmBakeSceneSel).toBe(1);
    expect(ui.confirmBakeSceneClip).toBe(6);
    expect(ui.pendingDefaultSetParams).toEqual([]);
  });

  test("pendingMergePlacement step queues merge_place_row", () => {
    ui.pendingMergePlacement = true;

    pressStep(h, 9);

    expect(ui.pendingMergePlacement).toBe(false);
    expect(ui.pendingDefaultSetParams).toEqual([{ key: "merge_place_row", val: "9" }]);
  });

  test("Mute+step defers mute snapshot recall to release", () => {
    ui.muteHeld = true;
    ui.trackMuted[0] = true;
    ui.trackSoloed[1] = true;
    ui.snapshots[5] = {
      mute: [false, true, false, false, false, false, false, false],
      solo: [false, false, true, false, false, false, false, false],
      drumEffMute: [1, 2, 3, 4, 5, 6, 7, 8],
    };

    pressStep(h, 5);
    expect(ui.sessionStepHeld).toBe(5);
    expect(ui.sessionStepHeldCtx).toBe(2);
    expect(ui.pendingDefaultSetParams).toEqual([]);
    expect(ui.trackMuted[0]).toBe(true);

    releaseStep(h, 5);
    expect(ui.trackMuted.slice(0, 3)).toEqual([false, true, false]);
    expect(ui.trackSoloed.slice(0, 3)).toEqual([false, false, true]);
    expect(ui.drumLaneMute.slice(0, 3)).toEqual([1, 2, 3]);
    expect(ui.drumLaneSolo.every((v) => v === 0)).toBe(true);
    expect(ui.pendingDefaultSetParams).toEqual([{ key: "snap_load", val: "5" }]);
  });

  test("Shift+step dispatches shortcut and does not queue launch_scene", () => {
    ui.shiftHeld = true;
    const before = ui.metronomeOn;

    pressStep(h, 5);

    expect(ui.metronomeOn).not.toBe(before);
    expect(h.get("metro_on")).toBe(String(ui.metronomeOn));
    expect(ui.pendingDefaultSetParams).toEqual([]);
  });

  test("Plain Session View step queues launch_scene", () => {
    pressStep(h, 10);

    expect(ui.pendingDefaultSetParams).toEqual([{ key: "launch_scene", val: "10" }]);
  });

  test("Delete-only Session View step is swallowed", () => {
    ui.deleteHeld = true;

    pressStep(h, 7);

    expect(ui.pendingDefaultSetParams).toEqual([]);
    expect(ui.sessionStepHeld).toBe(-1);
  });
});
