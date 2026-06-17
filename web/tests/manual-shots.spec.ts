import { test } from "@playwright/test";

// Manual-figure generator (spike). Drives the REAL tool UI in the browser
// emulator via the same MIDI gesture vocabulary as the vitest harness
// (globalThis.OVT.midiIn → emu.sendInternal) and captures the OLED to a PNG per
// state. The emulator runs the real ui.js, so these figures stay in sync with
// the UI automatically. Output: web/manual-shots/<name>.png (gitignored).
//
// Adding a figure = add a step below: drive the gesture, settle, snap(). The
// gesture scripts port directly from the integration tests (same CC numbers).

type Ovt = { midiIn(status: number, d1: number, d2: number): void };

test("capture manual figures", async ({ page }) => {
  await page.goto("/");
  await page.waitForTimeout(2500); // past the splash, into the main Track View

  const snap = (name: string) =>
    page.locator("#oled").screenshot({ path: `manual-shots/${name}.png` });

  // Drive a gesture in the page (OVT.midiIn is the device-MIDI entry point).
  const drive = (fn: (o: Ovt) => void) =>
    page.evaluate(`(${fn.toString()})(globalThis.OVT)`);

  // 1. Main Track View (boot state).
  await snap("01-main-view");

  // 2. Global menu — Shift(49)+NoteSession(50), exactly as harness.menuOpen().
  await drive((o) => {
    o.midiIn(0xb0, 49, 127);
    o.midiIn(0xb0, 50, 127);
    o.midiIn(0xb0, 50, 0);
    o.midiIn(0xb0, 49, 0);
  });
  await page.waitForTimeout(300);
  await snap("02-global-menu");

  // 3. Scroll the menu down a few items (jog rotate CW = CC 14, value 1).
  await drive((o) => {
    for (let i = 0; i < 6; i++) o.midiIn(0xb0, 14, 1);
  });
  await page.waitForTimeout(300);
  await snap("03-global-menu-scrolled");
});
