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
  copyHeld: boolean;
  copySrc: unknown;
  captureHeld: boolean;
  playing: boolean;
  trackPadMode: number[];
  trackActiveClip: number[];
  trackCurrentPage: number[];
  trackClipPlaying: boolean[];
  trackWillRelaunch: boolean[];
  trackQueuedClip: number[];
  clipNonEmpty: boolean[][];
  clipLoopStart: number[][];
  pendingDrumResync: number;
  pendingDrumResyncTrack: number;
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

function pressClipPad(h: Harness, track: number, row: number): void {
  const rowBase = 92 - row * 8;
  h.emu.sendInternal(0x90, rowBase + track, 110);
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
  ui.copyHeld = false;
  ui.copySrc = null;
  ui.captureHeld = false;
  ui.playing = false;
  ui.sceneRow = 0;
  ui.activeTrack = 0;
  ui.trackActiveClip.fill(0);
  ui.trackCurrentPage.fill(0);
  ui.trackClipPlaying.fill(false);
  ui.trackWillRelaunch.fill(false);
  ui.trackQueuedClip.fill(-1);
  ui.pendingDrumResync = 0;
  ui.pendingDrumResyncTrack = -1;
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

describe("Session View Workflow - clip pads", () => {
  let h: Harness;
  let ui: SessionUiState;

  beforeEach(async () => {
    h = await createHarness();
    ui = h.ui() as SessionUiState;
    resetSessionState(ui);
  }, 60_000);

  test("Delete+clip pad clears that clip and keeps transport state", () => {
    ui.deleteHeld = true;
    ui.trackPadMode[1] = 0;
    ui.clipNonEmpty[1][1] = true;

    pressClipPad(h, 1, 1);

    expect(ui.clipNonEmpty[1][1]).toBe(false);
    expect(ui.clearDrainHold).toBe(1);
    expect(ui.pendingDefaultSetParams).toEqual([{ key: "t1_c1_clear", val: "1" }]);
  });

  test("Shift+Delete+clip pad hard-resets that clip", () => {
    ui.deleteHeld = true;
    ui.shiftHeld = true;
    ui.trackPadMode[1] = 0;
    ui.clipNonEmpty[1][1] = true;
    ui.clipLength[1][1] = 64;
    ui.clipLoopStart[1][1] = 16;

    pressClipPad(h, 1, 1);

    expect(ui.clipNonEmpty[1][1]).toBe(false);
    expect(ui.clipLength[1][1]).toBe(16);
    expect(ui.clipLoopStart[1][1]).toBe(0);
    expect(ui.clearDrainHold).toBe(1);
    expect(ui.pendingDefaultSetParams).toEqual([{ key: "t1_c1_hard_reset", val: "1" }]);
  });

  test("Copy+clip pad arms a melodic clip source and paste queues clip_copy", () => {
    ui.copyHeld = true;
    ui.trackPadMode[1] = 0;
    ui.clipNonEmpty[1][1] = true;

    pressClipPad(h, 1, 1);
    expect(ui.copySrc).toEqual({ kind: "clip", track: 1, clip: 1 });
    expect(ui.pendingDefaultSetParams).toEqual([]);

    pressClipPad(h, 1, 2);
    expect(ui.pendingDefaultSetParams).toEqual([{ key: "clip_copy", val: "1 1 1 2" }]);
    expect(ui.clipNonEmpty[1][2]).toBe(true);
  });

  test("Shift+Copy+clip pad arms cut source and paste queues clip_cut", () => {
    ui.copyHeld = true;
    ui.shiftHeld = true;
    ui.trackPadMode[1] = 0;
    ui.clipNonEmpty[1][1] = true;

    pressClipPad(h, 1, 1);
    expect(ui.copySrc).toEqual({ kind: "cut_clip", track: 1, clip: 1 });

    pressClipPad(h, 1, 2);
    expect(ui.copySrc).toEqual({ kind: "clip", track: 1, clip: 2 });
    expect(ui.pendingDefaultSetParams).toEqual([{ key: "clip_cut", val: "1 1 1 2" }]);
    expect(ui.clipNonEmpty[1][1]).toBe(false);
    expect(ui.clipNonEmpty[1][2]).toBe(true);
  });

  test("Shift+clip pad opens the clip for editing without launching a stopped non-empty clip", () => {
    ui.shiftHeld = true;
    ui.trackPadMode[1] = 0;
    ui.trackActiveClip[1] = 0;
    ui.clipLoopStart[1][1] = 32;
    ui.clipNonEmpty[1][1] = true;

    pressClipPad(h, 1, 1);

    expect(ui.sessionView).toBe(false);
    expect(ui.activeTrack).toBe(1);
    expect(ui.trackActiveClip[1]).toBe(1);
    expect(ui.trackCurrentPage[1]).toBe(2);
    expect(ui.pendingDefaultSetParams).toEqual([]);
  });

  test("Plain Session View clip pad focuses and launches that clip while stopped", () => {
    ui.trackPadMode[1] = 0;
    ui.trackActiveClip[1] = 0;

    pressClipPad(h, 1, 2);

    expect(ui.sessionView).toBe(true);
    expect(ui.activeTrack).toBe(1);
    expect(ui.trackActiveClip[1]).toBe(2);
    expect(ui.trackCurrentPage[1]).toBe(0);
  });
});
