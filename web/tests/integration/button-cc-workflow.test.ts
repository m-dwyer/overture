import { describe, expect, test } from "vitest";
import {
  handleUiCaptureButton,
  handleUiCopyButton,
  handleUiDeleteButton,
  handleUiLoopPerfModeButton,
  handleUiMenuCoRunExitButton,
  handleUiMuteModifierButton,
  handleUiShiftButton,
} from "@tool-ui/ui_button_cc_workflow.mjs";

const CAPTURE = 52;
const COPY = 60;
const DELETE = 119;
const LOOP = 58;
const LOOP_TAP_TICKS = 40;
const MENU = 50;
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
    deleteHeld: false,
    deleteTapArmed: false,
    loopHeld: false,
    activeBank: 0,
    ccActiveLane: [0, 2, 0, 0],
    ccLaneLoopStart: [
      [[0, 0, 0]],
      [[0, 0, 0], [0, 0, 9], [0, 0, 0], [0, 0, 0]],
    ],
    ccLaneLength: [
      [[0, 0, 0]],
      [[0, 0, 0], [0, 0, 16], [0, 0, 0], [0, 0, 0]],
    ],
    ccLaneTps: [
      [[0, 0, 0]],
      [[0, 0, 0], [0, 0, 48], [0, 0, 0], [0, 0, 0]],
    ],
    ccLaneResTps: [
      [[0, 0, 0]],
      [[0, 0, 0], [0, 0, 24], [0, 0, 0], [0, 0, 0]],
    ],
    undoAvailable: false,
    redoAvailable: true,
    undoSeqArpSnapshot: { present: true },
    clearAutoMenu: null,
    schwungCoRunSlot: -1,
    // Loop perf-mode trackers
    tickCount: 0,
    loopPressTick: 0,
    perfLatchMode: false,
    perfViewLocked: false,
    loopJogActive: false,
    perfStack: [] as Array<{ idx: number; ticks: number }>,
    perfStickyLengths: new Set<number>(),
    perfHoldPadHeld: false,
    perfModsHeld: 0,
    ...overrides,
  };
}

function deps(c: ReturnType<typeof calls>, overrides: Record<string, unknown> = {}) {
  return {
    moveCapture: CAPTURE,
    moveCopy: COPY,
    moveDelete: DELETE,
    moveMenu: MENU,
    moveMute: MUTE,
    moveShift: SHIFT,
    padModeDrum: DRUM,
    computePadNoteMap: c.fn("padmap"),
    editSoundForTrack: c.fn("editSound"),
    effectiveClip: (track: number) => (track === 1 ? 1 : 0),
    exitSchwungCoRun: c.fn("exitCoRun"),
    forceRedraw: c.fn("redraw"),
    invalidateLEDCache: c.fn("ledInvalidate"),
    loopTapTicks: LOOP_TAP_TICKS,
    moveLoop: LOOP,
    openClearAutoMenu: c.fn("openClearAutoMenu"),
    sendPerfMods: c.fn("perfMods"),
    setParam: c.fn("setParam"),
    showActionPopup: c.fn("popup"),
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

describe("Button CC workflow - Delete button", () => {
  test("ignores non-Delete CCs", () => {
    const c = calls();
    expect(handleUiDeleteButton(state(), deps(c), 118, 127)).toBe(false);
    expect(c.log).toEqual([]);
  });

  test("Delete press tracks held state and re-pushes the pad map", () => {
    const c = calls();
    const S = state();

    expect(handleUiDeleteButton(S, deps(c), DELETE, 127)).toBe(false);

    expect(S.deleteHeld).toBe(true);
    expect(c.log).toEqual([["padmap"]]);
  });

  test("Delete release clears held state and re-pushes the pad map", () => {
    const c = calls();
    const S = state({ deleteHeld: true });

    expect(handleUiDeleteButton(S, deps(c), DELETE, 0)).toBe(false);

    expect(S.deleteHeld).toBe(false);
    expect(c.log).toEqual([["padmap"]]);
  });

  test("Loop+Delete on melodic AUTO bank resets the active automation lane and consumes the CC", () => {
    const c = calls();
    const S = state({ loopHeld: true, activeBank: 6, activeTrack: 1, sessionView: false });

    expect(handleUiDeleteButton(S, deps(c), DELETE, 127)).toBe(true);

    expect(S.deleteHeld).toBe(true);
    expect(S.ccLaneLoopStart[1][1][2]).toBe(0);
    expect(S.ccLaneLength[1][1][2]).toBe(0);
    expect(S.ccLaneTps[1][1][2]).toBe(0);
    expect(S.ccLaneResTps[1][1][2]).toBe(0);
    expect(S.undoAvailable).toBe(true);
    expect(S.redoAvailable).toBe(false);
    expect(S.undoSeqArpSnapshot).toBeNull();
    expect(S.pendingDefaultSetParams).toEqual([
      { key: "t1_c1_k2_cc_lane_reset", val: "1" },
    ]);
    expect(c.log).toEqual([["popup", "LANE LOOP", "RESET"], ["redraw"], ["padmap"]]);
  });

  test("Delete press on melodic AUTO bank arms the clear automation menu", () => {
    const c = calls();
    const S = state({ activeBank: 6, activeTrack: 1, sessionView: false });

    expect(handleUiDeleteButton(S, deps(c), DELETE, 127)).toBe(false);

    expect(S.deleteTapArmed).toBe(true);
    expect(c.log).toEqual([["padmap"]]);
  });

  test("Delete press does not arm the clear automation menu in Session View, drum tracks, or when already open", () => {
    const cases = [
      state({ activeBank: 6, activeTrack: 1, sessionView: true }),
      state({ activeBank: 6, activeTrack: 0, sessionView: false }),
      state({ activeBank: 6, activeTrack: 1, sessionView: false, clearAutoMenu: { sel: 0 } }),
    ];

    for (const S of cases) {
      const c = calls();
      expect(handleUiDeleteButton(S, deps(c), DELETE, 127)).toBe(false);
      expect(S.deleteTapArmed).toBe(false);
      expect(c.log).toEqual([["padmap"]]);
    }
  });

  test("Delete release after an armed tap opens the clear automation menu", () => {
    const c = calls();
    const S = state({ deleteHeld: true, deleteTapArmed: true });

    expect(handleUiDeleteButton(S, deps(c), DELETE, 0)).toBe(false);

    expect(S.deleteHeld).toBe(false);
    expect(S.deleteTapArmed).toBe(false);
    expect(c.log).toEqual([["openClearAutoMenu"], ["padmap"]]);
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

describe("Button CC workflow - Menu co-run exit", () => {
  test("ignores non-Menu CCs", () => {
    const c = calls();
    const S = state({ schwungCoRunSlot: 2 });
    expect(handleUiMenuCoRunExitButton(S, deps(c), DELETE, 127)).toBe(false);
    expect(c.log).toEqual([]);
  });

  test("ignores Menu release", () => {
    const c = calls();
    const S = state({ schwungCoRunSlot: 2 });
    expect(handleUiMenuCoRunExitButton(S, deps(c), MENU, 0)).toBe(false);
    expect(c.log).toEqual([]);
  });

  test("Menu press with no Schwung co-run is a no-op", () => {
    const c = calls();
    const S = state({ schwungCoRunSlot: -1 });
    expect(handleUiMenuCoRunExitButton(S, deps(c), MENU, 127)).toBe(false);
    expect(c.log).toEqual([]);
  });

  test("Menu press during Schwung co-run exits and redraws", () => {
    const c = calls();
    const S = state({ schwungCoRunSlot: 0 });
    expect(handleUiMenuCoRunExitButton(S, deps(c), MENU, 127)).toBe(true);
    expect(c.log).toEqual([["exitCoRun"], ["redraw"]]);
  });
});

describe("Button CC workflow - Loop perf mode (Session View)", () => {
  test("ignores non-Loop CCs", () => {
    const c = calls();
    const S = state({ sessionView: true });
    expect(handleUiLoopPerfModeButton(S, deps(c), MUTE, 127)).toBe(false);
    expect(c.log).toEqual([]);
  });

  test("ignores Loop in Track View (defers to the track-view sibling)", () => {
    const c = calls();
    const S = state({ sessionView: false });
    expect(handleUiLoopPerfModeButton(S, deps(c), LOOP, 127)).toBe(false);
    expect(c.log).toEqual([]);
  });

  test("Shift+Loop press toggles perf latch mode", () => {
    const c = calls();
    const S = state({ sessionView: true, shiftHeld: true, perfLatchMode: false });
    expect(handleUiLoopPerfModeButton(S, deps(c), LOOP, 127)).toBe(true);
    expect(S.perfLatchMode).toBe(true);
    expect(S.loopHeld).toBe(false); // shift branch returns before touching loopHeld
    expect(c.log).toEqual([["redraw"]]);
  });

  test("plain Loop press records press tick and held state", () => {
    const c = calls();
    const S = state({ sessionView: true, tickCount: 123, loopPressTick: -1 });
    expect(handleUiLoopPerfModeButton(S, deps(c), LOOP, 127)).toBe(true);
    expect(S.loopPressTick).toBe(123);
    expect(S.loopHeld).toBe(true);
    expect(c.log).toEqual([["redraw"]]);
  });

  test("locked + tap release unlocks and stops the looper", () => {
    const c = calls();
    const S = state({
      sessionView: true,
      perfViewLocked: true,
      loopHeld: true,
      loopJogActive: true,
      perfStack: [{ idx: 0, ticks: 48 }],
      perfStickyLengths: new Set([0]),
      perfHoldPadHeld: true,
      perfModsHeld: 2,
      tickCount: 10,
      loopPressTick: 0, // 10 < 40 => tap
    });
    expect(handleUiLoopPerfModeButton(S, deps(c), LOOP, 0)).toBe(true);
    expect(S.perfViewLocked).toBe(false);
    expect(S.loopHeld).toBe(false);
    expect(S.loopJogActive).toBe(false);
    expect(S.perfStack).toEqual([]);
    expect(S.perfStickyLengths.size).toBe(0);
    expect(S.perfHoldPadHeld).toBe(false);
    expect(S.perfModsHeld).toBe(0);
    expect(c.log).toEqual([
      ["perfMods"],
      ["setParam", "looper_stop", "1"],
      ["ledInvalidate"],
      ["redraw"],
    ]);
  });

  test("locked + hold release is a swallowed no-op", () => {
    const c = calls();
    const S = state({
      sessionView: true,
      perfViewLocked: true,
      tickCount: 100,
      loopPressTick: 0, // 100 >= 40 => hold, not a tap
    });
    expect(handleUiLoopPerfModeButton(S, deps(c), LOOP, 0)).toBe(true);
    expect(S.perfViewLocked).toBe(true); // unchanged
    expect(c.log).toEqual([]);
  });

  test("unlocked + tap release locks perf mode", () => {
    const c = calls();
    const S = state({
      sessionView: true,
      perfViewLocked: false,
      tickCount: 10,
      loopPressTick: 0, // tap
    });
    expect(handleUiLoopPerfModeButton(S, deps(c), LOOP, 0)).toBe(true);
    expect(S.perfViewLocked).toBe(true);
    expect(S.loopHeld).toBe(true);
    expect(c.log).toEqual([["redraw"]]);
  });

  test("unlocked + hold release with sticky lengths auto-locks and arms", () => {
    const c = calls();
    const S = state({
      sessionView: true,
      perfViewLocked: false,
      perfHoldPadHeld: false,
      perfStickyLengths: new Set([0, 2]),
      perfStack: [
        { idx: 0, ticks: 24 },
        { idx: 1, ticks: 48 }, // dropped: idx not sticky
        { idx: 2, ticks: 96 },
      ],
      tickCount: 100,
      loopPressTick: 0, // hold
    });
    expect(handleUiLoopPerfModeButton(S, deps(c), LOOP, 0)).toBe(true);
    expect(S.perfViewLocked).toBe(true);
    expect(S.perfStack).toEqual([
      { idx: 0, ticks: 24 },
      { idx: 2, ticks: 96 },
    ]);
    expect(c.log).toEqual([
      ["setParam", "looper_arm", "96"], // last surviving entry's ticks
      ["perfMods"],
      ["ledInvalidate"],
      ["redraw"],
    ]);
  });

  test("unlocked + hold release with hold pad keeps the full stack", () => {
    const c = calls();
    const S = state({
      sessionView: true,
      perfViewLocked: false,
      perfHoldPadHeld: true,
      perfStickyLengths: new Set<number>(),
      perfStack: [
        { idx: 0, ticks: 24 },
        { idx: 1, ticks: 48 },
      ],
      tickCount: 100,
      loopPressTick: 0, // hold
    });
    expect(handleUiLoopPerfModeButton(S, deps(c), LOOP, 0)).toBe(true);
    expect(S.perfViewLocked).toBe(true);
    expect(S.perfStack).toEqual([
      { idx: 0, ticks: 24 },
      { idx: 1, ticks: 48 },
    ]); // not filtered when a hold pad is down
    expect(c.log).toEqual([
      ["setParam", "looper_arm", "48"],
      ["perfMods"],
      ["ledInvalidate"],
      ["redraw"],
    ]);
  });

  test("unlocked + hold release with no sticky state stops and clears the stack", () => {
    const c = calls();
    const S = state({
      sessionView: true,
      perfViewLocked: false,
      perfHoldPadHeld: false,
      perfStickyLengths: new Set<number>(),
      perfStack: [{ idx: 0, ticks: 24 }],
      tickCount: 100,
      loopPressTick: 0, // hold
    });
    expect(handleUiLoopPerfModeButton(S, deps(c), LOOP, 0)).toBe(true);
    expect(S.perfViewLocked).toBe(false);
    expect(S.perfStack).toEqual([]);
    expect(c.log).toEqual([
      ["setParam", "looper_stop", "1"],
      ["perfMods"],
      ["ledInvalidate"],
      ["redraw"],
    ]);
  });
});
