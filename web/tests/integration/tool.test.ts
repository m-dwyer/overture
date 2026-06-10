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
    h.cc(3, 127);
    h.step(3);
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

  test("Route Check shows expected routes and detected Schwung slots", () => {
    openRouteCheck();
    const text = h.rec.text();
    expect(text).toMatch(/ROUTE CHECK/);
    expect(text).toMatch(/T1 Move Ch1/);
    expect(text).toMatch(/MANUAL/);
    expect(text).toMatch(/T5 Schwung Ch5/);
    expect(text).toMatch(/OK Slot1/);
    expect(text).toMatch(/T8 Schwung Ch8/);
    expect(text).toMatch(/OK Slot4/);
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
      const text = h.rec.text();
      expect(text).toMatch(/T7 Schwung Ch7/);
      expect(text).toMatch(/NO SLOT/);
    } finally {
      globalThis.shadow_get_slots = originalSlots;
      closeRouteCheckAndMenu();
    }
  });
});
