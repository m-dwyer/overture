import { describe, test, expect, beforeAll } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// One shared harness (re-importing ui.js per test isn't isolated without
// resetModules). Tests either read-only or return to a known state.
describe("tool integration (real ui.js + seq8-wasm, headless)", () => {
  let h: Harness;
  beforeAll(async () => { h = await createHarness(); }, 60_000);

  function openGlobalMenu(): void {
    h.hold(49); h.cc(50, 127); h.step(2); h.cc(50, 0); h.release(49); h.step(3);
  }

  function openRouteCheck(): void {
    openGlobalMenu();
    const ui = h.ui() as {
      globalMenuItems?: Array<{ label?: string }>;
      globalMenuState?: { selectedIndex: number };
    };
    const idx = ui.globalMenuItems?.findIndex((item) => item?.label === "Route Check") ?? -1;
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(ui.globalMenuState).toBeTruthy();
    ui.globalMenuState!.selectedIndex = idx;
    h.step(1);
    h.press(3);
    h.step(2);
  }

  function openEditSoundFromGlobalMenu(): void {
    openGlobalMenu();
    const ui = h.ui() as {
      globalMenuItems?: Array<{ label?: string }>;
      globalMenuState?: { selectedIndex: number };
    };
    const labels = ui.globalMenuItems?.map((item) => item?.label) ?? [];
    expect(labels).toContain("Edit Sound...");
    expect(labels).not.toContain("Edit Slot...");
    expect(labels).not.toContain("Edit Synth...");
    const idx = labels.findIndex((label) => label === "Edit Sound...");
    expect(ui.globalMenuState).toBeTruthy();
    ui.globalMenuState!.selectedIndex = idx;
    h.step(1);
    h.press(3);
    h.step(2);
  }

  function closeRouteCheckAndMenu(): void {
    h.cc(50, 127); h.step(1); h.cc(50, 0); h.step(1); // close Route Check
    h.cc(50, 127); h.step(1); h.cc(50, 0); h.step(1); // close Global Menu
  }

  function touchKnob(k: number, on: boolean): void {
    h.emu.sendInternal(on ? 0x90 : 0x80, k, on ? 127 : 0);
    h.step(2);
  }

  test("boots into the main view and the engine is queryable", () => {
    // Real UI printed the track strip (digits 1..8) to the OLED.
    expect(h.rec.text()).toMatch(/[1-8]/);
    // Empty clip reads as 256 zeros straight from the real engine.
    expect(h.get("t0_c0_steps")).toBe("0".repeat(256));
  });

  test("the tool lights LEDs", () => {
    expect(h.rec.litLeds()).toBeGreaterThan(0);
  });

  test("tick drains pending default set params into the real DSP one tick after clearDrainHold", () => {
    const ui = h.ui();
    h.set("t0_delay_retrig", "0");
    ui.pendingDefaultSetParams = [{ key: "t0_delay_retrig", val: "1" }];
    ui.clearDrainHold = 1;
    ui.pendingSetLoad = false;
    ui.pendingDspSync = 0;

    h.step(1);
    expect(ui.clearDrainHold).toBe(0);
    expect(ui.pendingDefaultSetParams).toHaveLength(1);
    expect(h.get("t0_delay_retrig")).toBe("0");

    h.step(1);
    expect(ui.pendingDefaultSetParams).toHaveLength(0);
    expect(h.get("t0_delay_retrig")).toBe("1");
  });

  test("Shift+Menu opens the global menu; the jog navigates it (not the K-encoders)", () => {
    // Open: Shift held while Menu is pressed.
    openGlobalMenu();
    const menuText = h.rec.text();
    expect(menuText).toMatch(/Channel|Route|Mode|Layout|VelIn|Track/i);

    // The K-encoders do NOT drive the global menu — turning one is a no-op here.
    h.encoder(0, 1); h.step(3);
    expect(h.rec.text(), "encoder K1 should not change the global menu").toBe(menuText);

    // The JOG (CC14 rotate) is the menu's navigation control — selection moves.
    h.cc(14, 1); h.step(3);
    expect(h.rec.text(), "jog should move the menu selection").not.toBe(menuText);

    // Close the menu (Menu alone toggles it shut) to leave a known state.
    h.cc(50, 127); h.step(2); h.cc(50, 0); h.step(3);
  });

  test("Global Menu jog navigation still works while Shift is held", () => {
    h.hold(49);
    h.cc(50, 127); h.step(2); h.cc(50, 0); h.step(3);
    const ui = h.ui();
    const beforeTrack = ui.activeTrack;
    const beforeText = h.rec.text();

    h.cc(14, 1); h.step(3);

    expect(h.ui().activeTrack).toBe(beforeTrack);
    expect(h.rec.text()).not.toBe(beforeText);

    h.release(49); h.step(1);
    h.cc(50, 127); h.step(2); h.cc(50, 0); h.step(3);
  });

  test("Route Check shows expected routes and detected Schwung slots", () => {
    openRouteCheck();
    let text = h.rec.text();
    expect(text).toMatch(/ROUTE CHECK/);
    expect(text).toMatch(/1-4\/8/);
    expect(text).toMatch(/T1 Move Ch1/);
    expect(text).toMatch(/T4 Move Ch4/);
    expect(text).toMatch(/MANUAL/);

    h.cc(14, 1); h.step(1);
    h.cc(14, 1); h.step(1);
    h.cc(14, 1); h.step(1);
    h.cc(14, 1); h.step(3);
    text = h.rec.text();
    expect(text).toMatch(/5-8\/8/);
    expect(text).toMatch(/T5 Schw Ch5/);
    expect(text).toMatch(/OK S1/);
    expect(text).toMatch(/T8 Schw Ch8/);
    expect(text).toMatch(/OK S4/);
    closeRouteCheckAndMenu();
  });

  test("Route Check shows NO SLOT when a Schwung channel has no slot", () => {
    const originalSlots = globalThis.shadow_get_slots;
    globalThis.shadow_get_slots = () => [
      { channel: 5, name: "Slot1" },
      { channel: 6, name: "Slot2" },
      { channel: 8, name: "Slot4" },
    ];
    try {
      openRouteCheck();
      h.cc(14, 1); h.step(1);
      h.cc(14, 1); h.step(1);
      h.cc(14, 1); h.step(1);
      h.cc(14, 1); h.step(3);
      const text = h.rec.text();
      expect(text).toMatch(/T7 Schw Ch7/);
      expect(text).toMatch(/NO SLOT/);
    } finally {
      globalThis.shadow_get_slots = originalSlots;
      closeRouteCheckAndMenu();
    }
  });

  test("Route Check shows no slot for an unmatched custom Schwung channel", () => {
    const ui = h.ui();
    h.set("t5_channel", 16);
    ui.trackChannel[5] = 16;
    try {
      openRouteCheck();
      h.cc(14, 1); h.step(1);
      h.cc(14, 1); h.step(1);
      h.cc(14, 1); h.step(1);
      h.cc(14, 1); h.step(3);
      const text = h.rec.text();
      expect(text).toMatch(/T6 Schw Ch16/);
      expect(text).toMatch(/NO SLOT/);
      expect(text).not.toMatch(/OK S2/);
    } finally {
      h.set("t5_channel", 6);
      ui.trackChannel[5] = 6;
      closeRouteCheckAndMenu();
    }
  });

  test("Route Check follows custom Schwung channel when a slot matches", () => {
    const ui = h.ui();
    const originalSlots = globalThis.shadow_get_slots;
    globalThis.shadow_get_slots = () => [
      { channel: 5, name: "Slot1" },
      { channel: 16, name: "Slot2" },
      { channel: 7, name: "Slot3" },
      { channel: 8, name: "Slot4" },
    ];
    h.set("t5_channel", 16);
    ui.trackChannel[5] = 16;
    try {
      openRouteCheck();
      h.cc(14, 1); h.step(1);
      h.cc(14, 1); h.step(1);
      h.cc(14, 1); h.step(1);
      h.cc(14, 1); h.step(3);
      const text = h.rec.text();
      expect(text).toMatch(/T6 Schw Ch16/);
      expect(text).toMatch(/OK S2/);
    } finally {
      globalThis.shadow_get_slots = originalSlots;
      h.set("t5_channel", 6);
      ui.trackChannel[5] = 6;
      closeRouteCheckAndMenu();
    }
  });

  test("Edit Sound menu action preflights Move route then enters Move co-run", () => {
    const ui = h.ui();
    ui.activeTrack = 0;
    openEditSoundFromGlobalMenu();
    expect(ui.pendingEditSoundEntry).toBeTruthy();
    expect(h.rec.text()).toMatch(/EDIT SOUND/);
    expect(h.rec.text()).toMatch(/T1 Move Ch1/);
    h.step(30);
    expect(ui.moveCoRunTrack).toBe(0);
    expect(globalThis.shadow_corun_state()).toMatchObject({ target: 2, id: 0 });
    h.tapStep(2);
    h.step(3);
    expect(ui.moveCoRunTrack).toBe(-1);
    expect(globalThis.shadow_corun_state()).toBeNull();
  });

  test("Shift+Step 3 preflights Schwung route then enters chain co-run", () => {
    const ui = h.ui();
    ui.activeTrack = 4;
    ui.sessionView = false;
    h.hold(49);
    h.tapStep(2);
    h.release(49);
    h.step(3);
    expect(ui.pendingEditSoundEntry).toBeTruthy();
    expect(h.rec.text()).toMatch(/EDIT SOUND/);
    expect(h.rec.text()).toMatch(/T5 Schwung Slot1/);
    h.step(30);
    expect(ui.schwungCoRunSlot).toBe(0);
    expect(globalThis.shadow_corun_state()).toMatchObject({ target: 1, id: 0 });
    h.cc(50, 127); h.step(1); h.cc(50, 0); h.step(3);
    expect(ui.schwungCoRunSlot).toBe(-1);
    expect(globalThis.shadow_corun_state()).toBeNull();
  });

  test("Move co-run cleans up when the upstream host clears state externally", () => {
    const ui = h.ui();
    ui.activeTrack = 0;
    openEditSoundFromGlobalMenu();
    h.step(30);
    expect(ui.moveCoRunTrack).toBe(0);
    globalThis.shadow_corun_end();
    h.step(3);
    expect(ui.moveCoRunTrack).toBe(-1);
    expect(globalThis.shadow_corun_state()).toBeNull();
  });

  test("Schwung co-run cleans up when the upstream host clears state externally", () => {
    const ui = h.ui();
    ui.activeTrack = 4;
    ui.sessionView = false;
    h.hold(49);
    h.tapStep(2);
    h.release(49);
    h.step(3);
    h.step(30);
    expect(ui.schwungCoRunSlot).toBe(0);
    globalThis.shadow_corun_end();
    h.step(3);
    expect(ui.schwungCoRunSlot).toBe(-1);
    expect(globalThis.shadow_corun_state()).toBeNull();
  });

  test("Edit Sound shows NO SLOT preflight for unmatched Schwung route", () => {
    const ui = h.ui();
    const originalSlots = globalThis.shadow_get_slots;
    globalThis.shadow_get_slots = () => [
      { channel: 6, name: "Slot2" },
      { channel: 7, name: "Slot3" },
      { channel: 8, name: "Slot4" },
    ];
    ui.activeTrack = 4;
    ui.sessionView = false;
    try {
      openEditSoundFromGlobalMenu();
      expect(h.rec.text()).toMatch(/NO SLOT/);
      expect(h.rec.text()).toMatch(/Ch5/);
      h.step(30);
      expect(ui.schwungCoRunSlot).toBe(0);
      h.cc(50, 127); h.step(1); h.cc(50, 0); h.step(3);
      expect(ui.schwungCoRunSlot).toBe(-1);
    } finally {
      globalThis.shadow_get_slots = originalSlots;
    }
  });

  test("Edit Sound reports unavailable when co-run host API is missing", () => {
    const ui = h.ui();
    const originalBegin = globalThis.shadow_corun_begin;
    Reflect.set(globalThis, "shadow_corun_begin", undefined);
    ui.activeTrack = 0;
    try {
      openEditSoundFromGlobalMenu();
      expect(h.rec.text()).toMatch(/CO-RUN/);
      expect(h.rec.text()).toMatch(/UNAVAILABLE/);
      expect(ui.pendingEditSoundEntry).toBeNull();
      h.step(30);
      expect(ui.moveCoRunTrack).toBe(-1);
    } finally {
      Reflect.set(globalThis, "shadow_corun_begin", originalBegin);
    }
  });

  test("Edit Sound keeps current invalid Move-channel preflight behavior", () => {
    const ui = h.ui();
    const oldChannel = ui.trackChannel[0];
    ui.activeTrack = 0;
    ui.trackChannel[0] = 5;
    h.set("t0_channel", 5);
    try {
      openEditSoundFromGlobalMenu();
      expect(h.rec.text()).toMatch(/MOVE CH>4/);
      expect(h.rec.text()).toMatch(/Ch5/);
      expect(ui.pendingEditSoundEntry).toBeTruthy();

      h.step(36);
      expect(ui.moveCoRunTrack).toBe(0);
      expect(ui.pendingMoveCoRunInject).toBe(0);
      expect(ui.moveCoRunPressQueue == null || (ui.moveCoRunPressQueue as unknown[]).length === 0).toBe(true);
      globalThis.shadow_corun_end?.();
      h.step(10);
      expect(ui.moveCoRunTrack).toBe(-1);
    } finally {
      globalThis.shadow_corun_end?.();
      ui.moveCoRunTrack = -1;
      ui.pendingMoveCoRunInject = 0;
      ui.moveCoRunPressQueue = null;
      ui.globalMenuOpen = false;
      ui.trackChannel[0] = oldChannel;
      h.set("t0_channel", oldChannel);
      h.step(10);
    }
  });

  test("pending Edit Sound entry cancels if the active track changes before handoff", () => {
    const ui = h.ui();
    ui.activeTrack = 0;
    openEditSoundFromGlobalMenu();
    expect(ui.pendingEditSoundEntry).toBeTruthy();

    ui.activeTrack = 1;
    h.step(30);

    expect(ui.pendingEditSoundEntry).toBeNull();
    expect(ui.moveCoRunTrack).toBe(-1);
    expect(globalThis.shadow_corun_state()).toBeNull();
  });

  test("external routes do not expose Edit Sound in the global menu", () => {
    const ui = h.ui() as ReturnType<Harness["ui"]> & {
      globalMenuItems?: Array<{ label?: string }>;
      globalMenuOpen?: boolean;
    };
    const oldRoute = ui.trackRoute[0];
    ui.activeTrack = 0;
    ui.trackRoute[0] = 2;
    h.set("t0_route", "external");
    try {
      openGlobalMenu();
      const labels = ui.globalMenuItems?.map((item) => item?.label) ?? [];
      expect(labels).not.toContain("Edit Sound...");
      h.cc(50, 127); h.step(2); h.cc(50, 0); h.step(3);
    } finally {
      ui.trackRoute[0] = oldRoute;
      h.set("t0_route", oldRoute === 2 ? "external" : oldRoute === 1 ? "move" : "schwung");
      ui.globalMenuOpen = false;
    }
  });

  test("AUTO knob touch shows Param Peek with lane label, value, and scope without mutating", () => {
    const ui = h.ui();
    ui.activeTrack = 0;
    ui.activeBank = 6;
    ui.sessionView = false;
    ui.trackPadMode[0] = 0;
    ui.knobTouched = -1;
    ui.trackCCType[0] = [1, 0, 2, 0, 0, 0, 0, 0];
    ui.trackCCAssign[0] = [7, 74, 5, -1, 72, 91, 93, 10];
    ui.clipCCVal[0][0][1] = 64;
    const before = h.get("t0_cc_assigns");

    try {
      touchKnob(1, true);

      const text = h.rec.text();
      expect(text).toMatch(/AUTO T1 Clip A/);
      expect(text).toMatch(/Move target/);
      expect(text).toMatch(/Value 64/);
      expect(text).toMatch(/Clip A, Lane 2/);
      expect(text).toMatch(/Route: Move Ch1/);
      expect(h.get("t0_cc_assigns")).toBe(before);
    } finally {
      touchKnob(1, false);
    }
  });

  test("AUTO labels distinguish AT, CC, Sch, and unassigned lanes", () => {
    const ui = h.ui();
    ui.activeTrack = 0;
    ui.activeBank = 6;
    ui.sessionView = false;
    ui.trackPadMode[0] = 0;
    ui.knobTouched = -1;
    ui.trackCCType[0] = [1, 0, 2, 0, 0, 0, 0, 0];
    ui.trackCCAssign[0] = [7, 74, 5, -1, 72, 91, 93, 10];
    ui.clipCCVal[0][0][0] = 10;
    ui.clipCCVal[0][0][1] = 64;
    ui.clipCCVal[0][0][2] = 99;
    ui.clipCCVal[0][0][3] = -1;

    try {
      touchKnob(0, true);
      expect(h.rec.text()).toMatch(/Aftertouch/);
      touchKnob(0, false);

      touchKnob(2, true);
      expect(h.rec.text()).toMatch(/Schwung knob 5/);
      touchKnob(2, false);

      touchKnob(3, true);
      expect(h.rec.text()).toMatch(/No target assigned/);
    } finally {
      touchKnob(3, false);
    }
  });

  test("AUTO Param Peek names common CC targets outside Move routing", () => {
    const ui = h.ui();
    ui.activeTrack = 0;
    ui.activeBank = 6;
    ui.sessionView = false;
    ui.trackPadMode[0] = 0;
    ui.knobTouched = -1;
    const oldRoute = ui.trackRoute[0];
    ui.trackRoute[0] = 2;
    ui.trackCCType[0] = [0, 0, 0, 0, 0, 0, 0, 0];
    ui.trackCCAssign[0] = [7, 74, 22, 10, 11, 91, 93, 64];

    try {
      touchKnob(1, true);
      expect(h.rec.text()).toMatch(/CC74 Filter/);
      touchKnob(1, false);

      touchKnob(2, true);
      expect(h.rec.text()).toMatch(/CC22/);
      touchKnob(2, false);

      touchKnob(0, true);
      expect(h.rec.text()).toMatch(/CC7 Volume/);
    } finally {
      touchKnob(0, false);
      ui.trackRoute[0] = oldRoute;
    }
  });

  test("AUTO Param Peek reveals lane timing detail when held", () => {
    const ui = h.ui();
    ui.activeTrack = 0;
    ui.activeBank = 6;
    ui.sessionView = false;
    ui.trackPadMode[0] = 0;
    ui.knobTouched = -1;
    ui.trackCCType[0] = [0, 0, 0, 0, 0, 0, 0, 0];
    ui.trackCCAssign[0] = [7, 74, 22, 10, 11, 91, 93, 64];
    ui.clipCCVal[0][0][1] = 64;
    ui.ccLaneLength[0][0][1] = 32;
    ui.ccLaneTps[0][0][1] = 12;
    ui.ccLaneResTps[0][0][1] = 24;

    try {
      touchKnob(1, true);
      let text = h.rec.text();
      expect(text).toMatch(/AUTO T1 Clip A/);
      expect(text).toMatch(/Move target/);
      expect(text).toMatch(/Value 64/);

      h.step(50);
      text = h.rec.text();
      expect(text).toMatch(/Move target/);
      expect(text).toMatch(/Lane 2 \/ Clip A/);
      expect(text).toMatch(/Route: Move Ch1/);
      expect(text).toMatch(/Loop 32 steps/);
      expect(text).toMatch(/Res 1\/16 Zoom 1\/32/);
    } finally {
      ui.ccLaneLength[0][0][1] = 0;
      ui.ccLaneTps[0][0][1] = 0;
      ui.ccLaneResTps[0][0][1] = 0;
      touchKnob(1, false);
    }
  });

  test("AUTO Param Peek gives a readable drum-mode fallback", () => {
    const ui = h.ui();
    ui.activeTrack = 0;
    ui.activeBank = 6;
    ui.sessionView = false;
    ui.trackPadMode[0] = 1;
    ui.knobTouched = -1;

    try {
      touchKnob(0, true);
      const text = h.rec.text();
      expect(text).toMatch(/AUTO T1 Drum/);
      expect(text).toMatch(/Melodic AUTO only/);
      expect(text).toMatch(/Use DRUM\/NOTE banks/);
      expect(text).toMatch(/Route: Move Ch1/);
    } finally {
      touchKnob(0, false);
    }
  });

  test("Param Peek has a non-AUTO bank fallback for unassigned knobs", () => {
    const ui = h.ui();
    ui.activeTrack = 0;
    ui.activeBank = 1;
    ui.sessionView = false;
    ui.trackPadMode[0] = 0;
    ui.knobTouched = -1;

    try {
      touchKnob(6, true);
      const text = h.rec.text();
      expect(text).toMatch(/NOTE FX T1/);
      expect(text).toMatch(/No target assigned/);
      expect(text).toMatch(/Knob 7/);
      expect(text).toMatch(/Route: Move Ch1/);
    } finally {
      touchKnob(6, false);
    }
  });

  test("Shift held in Track View shows compact shortcut help", () => {
    const ui = h.ui();
    ui.sessionView = false;
    ui.activeBank = 0;
    ui.knobTouched = -1;
    ui.deleteHeld = false;
    ui.copyHeld = false;
    ui.muteHeld = false;
    ui.loopHeld = false;

    try {
      h.hold(49);
      h.step(2);

      const text = h.rec.text();
      expect(text).toMatch(/SHIFT SHORTCUTS/);
      expect(text).toMatch(/S2 Global/);
      expect(text).toMatch(/S3 Edit/);
      expect(text).toMatch(/S15 x2/);
    } finally {
      h.release(49);
      h.step(2);
    }
  });

  test("malformed last_restore falls back to full clip sync", () => {
    const ui = h.ui();
    h.set("t1_c0_step_3_add", "64 0 100");
    expect(h.get("t1_c0_steps")?.[3]).toBe("1");

    (ui.clipSteps as number[][][])[1][0][3] = 0;
    (ui.clipNonEmpty as boolean[][])[1][0] = false;
    ui.pendingUndoSync = 1;
    ui.recordArmed = false;
    ui.recordCountingIn = false;
    ui.recordArmedTrack = -1;

    const originalGet = globalThis.host_module_get_param;
    globalThis.host_module_get_param = (key: string): string | null =>
      key === "last_restore" ? "malformed" : originalGet(key);
    try {
      h.step(1);
    } finally {
      globalThis.host_module_get_param = originalGet;
      h.set("t1_c0_step_3_clear", "1");
      h.step(2);
    }

    expect(ui.pendingUndoSync).toBe(0);
    expect((ui.clipSteps as number[][][])[1][0][3]).toBe(1);
    expect((ui.clipNonEmpty as boolean[][])[1][0]).toBe(true);
  });

  test("targeted DR row sync keeps active-row lane readback selection in UI caller", () => {
    const ui = h.ui();
    ui.trackActiveClip = [2, 1, 2, 3, 2, 5, 6, 7];
    ui.activeDrumLane = [1, 2, 3, 4, 5, 6, 7, 8];
    ui.pendingUndoSync = 1;
    ui.recordArmed = false;
    ui.recordCountingIn = false;
    ui.recordArmedTrack = -1;

    const reads: string[] = [];
    const originalGet = globalThis.host_module_get_param;
    globalThis.host_module_get_param = (key: string): string | null => {
      reads.push(key);
      return key === "last_restore" ? "d 99 99 DR 2" : originalGet(key);
    };
    try {
      h.step(1);
    } finally {
      globalThis.host_module_get_param = originalGet;
    }

    expect(ui.pendingUndoSync).toBe(0);
    expect(reads).toContain("t0_l1_pfx_snapshot");
    expect(reads).toContain("t2_l3_pfx_snapshot");
    expect(reads).toContain("t4_l5_pfx_snapshot");
    expect(reads).not.toContain("t1_l2_pfx_snapshot");
    expect(reads).not.toContain("t3_l4_pfx_snapshot");
    expect(reads).not.toContain("t5_l6_pfx_snapshot");
  });
});
