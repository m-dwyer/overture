import { describe, expect, test } from "vitest";
import {
  handleUiCaptureButton,
  handleUiCopyButton,
  handleUiMuteModifierButton,
  handleUiShiftButton,
} from "@tool-ui/ui_button_cc_workflow.mjs";

const CAPTURE = 52;
const COPY = 60;
const MUTE = 88;
const SHIFT = 49;
const DRUM = 1;

function calls() {
  const log: Array<[string, ...unknown[]]> = [];
  return {
    log,
    fn(name: string) {
      return (...args: unknown[]) => log.push([name, ...args]);
    },
  };
}

function state(overrides: Record<string, unknown> = {}) {
  return {
    captureHeld: false,
    captureUsedAsModifier: false,
    pendingSceneBakePicker: false,
    pendingMergePlacement: false,
    pendingDefaultSetParams: [] as Array<{ key: string; val: string }>,
    confirmBake: false,
    confirmBakeDrumLoopOpen: false,
    confirmBakeWrapPhase: false,
    confirmBakeScene: false,
    confirmBakeIsDrum: false,
    confirmBakeIsMultiLoop: false,
    confirmBakeSel: 0,
    confirmBakeTrack: -1,
    confirmBakeClip: -1,
    sessionView: false,
    screenDirty: false,
    activeTrack: 1,
    trackActiveClip: [0, 3, 0, 0],
    trackPadMode: [1, 0, 0, 0], // track 0 drum, track 1 melodic
    // Copy / Mute modifier trackers
    copyHeld: false,
    copySrc: null,
    muteHeld: false,
    muteUsedAsModifier: false,
    shiftHeld: false,
    shiftTrackLEDActive: false,
    jogTouched: false,
    pendingEditEntryTrack: -1,
    ...overrides,
  };
}

function deps(c: ReturnType<typeof calls>, overrides: Record<string, unknown> = {}) {
  return {
    moveCapture: CAPTURE,
    moveCopy: COPY,
    moveMute: MUTE,
    moveShift: SHIFT,
    padModeDrum: DRUM,
    computePadNoteMap: c.fn("padmap"),
    editSoundForTrack: c.fn("editSound"),
    forceRedraw: c.fn("redraw"),
    invalidateLEDCache: c.fn("ledInvalidate"),
    ...overrides,
  };
}

describe("Button CC workflow - Shift button", () => {
  test("ignores non-Shift CCs", () => {
    const c = calls();
    expect(handleUiShiftButton(state(), deps(c), 48, 127)).toBeUndefined();
    expect(c.log).toEqual([]);
  });

  test("Shift press sets held state, activates the track LED overlay, re-pushes pad map, and redraws Track View", () => {
    const c = calls();
    const S = state();

    handleUiShiftButton(S, deps(c), SHIFT, 127);

    expect(S.shiftHeld).toBe(true);
    expect(S.shiftTrackLEDActive).toBe(true);
    expect(c.log).toEqual([["padmap"], ["redraw"]]);
  });

  test("Shift release clears held state, clears jog touch, re-pushes pad map, and redraws Track View", () => {
    const c = calls();
    const S = state({ shiftHeld: true, shiftTrackLEDActive: true, jogTouched: true });

    handleUiShiftButton(S, deps(c), SHIFT, 0);

    expect(S.shiftHeld).toBe(false);
    expect(S.shiftTrackLEDActive).toBe(false);
    expect(S.jogTouched).toBe(false);
    expect(c.log).toEqual([["padmap"], ["redraw"]]);
  });

  test("Shift release dispatches deferred edit-entry and clears the pending track before redraw", () => {
    const c = calls();
    const S = state({ shiftHeld: true, pendingEditEntryTrack: 2 });

    handleUiShiftButton(S, deps(c), SHIFT, 0);

    expect(S.pendingEditEntryTrack).toBe(-1);
    expect(c.log).toEqual([["padmap"], ["editSound", 2], ["redraw"]]);
  });

  test("Shift transitions in Session View skip redraw but still re-push the pad map", () => {
    const c = calls();
    const S = state({ sessionView: true });

    handleUiShiftButton(S, deps(c), SHIFT, 127);

    expect(S.shiftHeld).toBe(true);
    expect(S.shiftTrackLEDActive).toBe(true);
    expect(c.log).toEqual([["padmap"]]);
  });
});

describe("Button CC workflow - Capture button", () => {
  test("ignores non-Capture CCs", () => {
    const c = calls();
    const d = deps(c);

    expect(handleUiCaptureButton(state(), d, 51, 127)).toBeUndefined();
    expect(handleUiCaptureButton(state(), d, 51, 0)).toBeUndefined();

    expect(c.log).toEqual([]);
  });

  test("Capture press tracks held state and clears modifier use", () => {
    const c = calls();
    const S = state({ captureUsedAsModifier: true });

    handleUiCaptureButton(S, deps(c), CAPTURE, 127);

    expect(S.captureHeld).toBe(true);
    expect(S.captureUsedAsModifier).toBe(false);
    expect(c.log).toEqual([["padmap"], ["redraw"]]);
  });

  test("Capture press cancels the scene-bake picker as a modifier", () => {
    const c = calls();
    const S = state({ pendingSceneBakePicker: true });

    handleUiCaptureButton(S, deps(c), CAPTURE, 127);

    expect(S.pendingSceneBakePicker).toBe(false);
    expect(S.captureUsedAsModifier).toBe(true);
  });

  test("Capture press cancels pending merge placement and queues merge_cancel", () => {
    const c = calls();
    const S = state({ pendingMergePlacement: true });

    handleUiCaptureButton(S, deps(c), CAPTURE, 127);

    expect(S.pendingMergePlacement).toBe(false);
    expect(S.captureUsedAsModifier).toBe(true);
    expect(S.pendingDefaultSetParams).toEqual([{ key: "merge_cancel", val: "1" }]);
  });

  test("Capture press cancels the clip-bake confirm and its sub-flags", () => {
    const c = calls();
    const S = state({
      confirmBake: true,
      confirmBakeDrumLoopOpen: true,
      confirmBakeWrapPhase: true,
    });

    handleUiCaptureButton(S, deps(c), CAPTURE, 127);

    expect(S.confirmBake).toBe(false);
    expect(S.confirmBakeDrumLoopOpen).toBe(false);
    expect(S.confirmBakeWrapPhase).toBe(false);
    expect(S.captureUsedAsModifier).toBe(true);
  });

  test("Capture press cancels the scene-bake confirm", () => {
    const c = calls();
    const S = state({ confirmBakeScene: true });

    handleUiCaptureButton(S, deps(c), CAPTURE, 127);

    expect(S.confirmBakeScene).toBe(false);
    expect(S.captureUsedAsModifier).toBe(true);
  });

  test("bare-tap release in Track View on a melodic track opens the multi-loop clip-bake confirm", () => {
    const c = calls();
    const S = state({ captureHeld: true, sessionView: false, activeTrack: 1 });

    handleUiCaptureButton(S, deps(c), CAPTURE, 0);

    expect(S.captureHeld).toBe(false);
    expect(S.confirmBake).toBe(true);
    expect(S.confirmBakeIsDrum).toBe(false);
    expect(S.confirmBakeIsMultiLoop).toBe(true);
    expect(S.confirmBakeSel).toBe(1);
    expect(S.confirmBakeTrack).toBe(1);
    expect(S.confirmBakeClip).toBe(3);
    expect(S.screenDirty).toBe(true);
    expect(c.log).toEqual([["padmap"], ["redraw"]]);
  });

  test("bare-tap release in Track View on a drum track opens the drum clip-bake confirm", () => {
    const c = calls();
    const S = state({ captureHeld: true, sessionView: false, activeTrack: 0 });

    handleUiCaptureButton(S, deps(c), CAPTURE, 0);

    expect(S.confirmBake).toBe(true);
    expect(S.confirmBakeIsDrum).toBe(true);
    expect(S.confirmBakeIsMultiLoop).toBe(false);
    expect(S.confirmBakeSel).toBe(2);
    expect(S.confirmBakeTrack).toBe(0);
    expect(S.confirmBakeClip).toBe(0);
  });

  test("bare-tap release in Session View arms the scene-bake picker", () => {
    const c = calls();
    const S = state({ captureHeld: true, sessionView: true });

    handleUiCaptureButton(S, deps(c), CAPTURE, 0);

    expect(S.pendingSceneBakePicker).toBe(true);
    expect(S.confirmBake).toBe(false);
    expect(S.screenDirty).toBe(true);
  });

  test("release after modifier use opens nothing", () => {
    const c = calls();
    const S = state({ captureHeld: true, captureUsedAsModifier: true, sessionView: false });

    handleUiCaptureButton(S, deps(c), CAPTURE, 0);

    expect(S.captureHeld).toBe(false);
    expect(S.confirmBake).toBe(false);
    expect(S.pendingSceneBakePicker).toBe(false);
    expect(c.log).toEqual([["padmap"], ["redraw"]]);
  });
});

describe("Button CC workflow - Copy button", () => {
  test("ignores non-Copy CCs", () => {
    const c = calls();
    expect(handleUiCopyButton(state(), deps(c), 59, 127)).toBeUndefined();
    expect(c.log).toEqual([]);
  });

  test("Copy press sets held state and re-pushes the pad map (no LED invalidate)", () => {
    const c = calls();
    const S = state();

    handleUiCopyButton(S, deps(c), COPY, 127);

    expect(S.copyHeld).toBe(true);
    expect(c.log).toEqual([["padmap"]]);
  });

  test("Copy release clears held state, drops the copy source, and invalidates LEDs", () => {
    const c = calls();
    const S = state({ copyHeld: true, copySrc: { track: 1, clip: 2 } });

    handleUiCopyButton(S, deps(c), COPY, 0);

    expect(S.copyHeld).toBe(false);
    expect(S.copySrc).toBeNull();
    expect(c.log).toEqual([["ledInvalidate"], ["padmap"]]);
  });
});

describe("Button CC workflow - Mute modifier tracker", () => {
  test("ignores non-Mute CCs", () => {
    const c = calls();
    expect(handleUiMuteModifierButton(state(), deps(c), 87, 127)).toBeUndefined();
    expect(c.log).toEqual([]);
  });

  test("Mute press sets held state and clears modifier-use", () => {
    const c = calls();
    const S = state({ muteUsedAsModifier: true });

    handleUiMuteModifierButton(S, deps(c), MUTE, 127);

    expect(S.muteHeld).toBe(true);
    expect(S.muteUsedAsModifier).toBe(false);
    expect(c.log).toEqual([["padmap"]]);
  });

  test("Mute release clears held state but leaves modifier-use untouched", () => {
    const c = calls();
    const S = state({ muteHeld: true, muteUsedAsModifier: true });

    handleUiMuteModifierButton(S, deps(c), MUTE, 0);

    expect(S.muteHeld).toBe(false);
    expect(S.muteUsedAsModifier).toBe(true); // only press resets it
    expect(c.log).toEqual([["padmap"]]);
  });

  test("Mute in Session View invalidates the LED cache before re-pushing the pad map", () => {
    const c = calls();
    const S = state({ sessionView: true });

    handleUiMuteModifierButton(S, deps(c), MUTE, 127);

    expect(c.log).toEqual([["ledInvalidate"], ["padmap"]]);
  });
});
