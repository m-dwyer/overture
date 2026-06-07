import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- in-page globals are untyped
type AnyGlobal = any;

// Smoke + screenshot: the real tool UI should boot and render to the OLED canvas
// without throwing. Captures shot.png (full page) + shot-oled.png (crop) for review.
test("emulator boots the real tool UI and renders", async ({ page }) => {
  const consoleErrors: string[] = [];
  const pageErrors: string[] = [];
  page.on("console", (m) => { if (m.type() === "error") consoleErrors.push(m.text()); });
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/");
  await page.waitForTimeout(2500); // past the splash; let init() + ticks settle

  await page.screenshot({ path: "shot.png" });
  await page.locator("#oled").screenshot({ path: "shot-oled.png" });

  await expect(page.locator("#status")).toHaveText("running");
  if (consoleErrors.length) console.log("console errors:\n" + consoleErrors.slice(0, 25).join("\n"));
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});

// The shell must (a) emit the exact device MIDI on a click and (b) drive a visible
// re-render of the real UI.
test("hardware shell emits device MIDI and drives the UI", async ({ page }) => {
  const pageErrors: string[] = [];
  page.on("pageerror", (e) => pageErrors.push(e.message));

  await page.goto("/");
  await page.waitForTimeout(3000); // past the splash, into the main view
  await page.locator("#oled").screenshot({ path: "shot-session.png" });

  // (a) A DOM shell button delivers the exact device MIDI. Use Step 1 (CC16) —
  // a non-view-changing control so it doesn't disturb (b).
  await page.evaluate(() => {
    const g = globalThis as AnyGlobal;
    const orig = g.onMidiMessageInternal;
    g.__midi = [];
    g.onMidiMessageInternal = (d: number[]) => { g.__midi.push([...d]); return orig?.(d); };
  });
  await page.locator("#shell .step").first().click();
  const midi = await page.evaluate(() => (globalThis as AnyGlobal).__midi);
  expect(midi).toEqual([[0xb0, 16, 127], [0xb0, 16, 0]]);

  // (b) Shift+Menu opens the global menu → the OLED must change.
  const mi = (s: number, d1: number, d2: number) =>
    page.evaluate(([a, b, c]) => (globalThis as AnyGlobal).OVT.midiIn(a, b, c), [s, d1, d2]);
  await mi(0xb0, 49, 127); // Shift down
  await mi(0xb0, 50, 127); // Menu down → openGlobalMenu
  await mi(0xb0, 50, 0);
  await mi(0xb0, 49, 0);   // Shift up
  await page.waitForTimeout(400);
  await page.locator("#oled").screenshot({ path: "shot-menu.png" });

  const before = await readFile("shot-session.png");
  const after = await readFile("shot-menu.png");
  expect(Buffer.compare(before, after), "OLED should change when input is received").not.toBe(0);
  expect(pageErrors, pageErrors.join("\n")).toEqual([]);
});
