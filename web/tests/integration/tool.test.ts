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

  test("boots into the main view and the engine is queryable", () => {
    // Real UI printed the track strip (digits 1..8) to the OLED.
    expect(h.rec.text()).toMatch(/[1-8]/);
    // Empty clip reads as 256 zeros straight from the real engine.
    expect(h.get("t0_c0_steps")).toBe("0".repeat(256));
  });

  test("the tool lights LEDs", () => {
    expect(h.rec.litLeds()).toBeGreaterThan(0);
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
    h.tapStep(2);
    h.step(3);
    expect(ui.moveCoRunTrack).toBe(-1);
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
    h.cc(50, 127); h.step(1); h.cc(50, 0); h.step(3);
    expect(ui.schwungCoRunSlot).toBe(-1);
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
});
