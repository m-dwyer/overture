import { test, expect } from "@playwright/test";

// Display-fidelity sweep: drive Overture to representative pages and lock a golden
// OLED snapshot of each. Catches render-fidelity regressions (the font-overlap
// class) systematically instead of by luck. OLED-only (the shell's LEDs blink, the
// OLED is static), and we never press Play, so each page is deterministic.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyGlobal = any;
type Page = import("@playwright/test").Page;

const mi = (page: Page, s: number, d1: number, d2: number) =>
  page.evaluate(([a, b, c]) => (globalThis as AnyGlobal).OVT.midiIn(a, b, c), [s, d1, d2]);

// momentary CC press (down+up)
const tap = async (page: Page, cc: number) => {
  await mi(page, 0xb0, cc, 127);
  await mi(page, 0xb0, cc, 0);
};
// step note press (down+up): step N (1-based) = note 15+N
const step = async (page: Page, n: number) => {
  await mi(page, 0x90, 15 + n, 127);
  await mi(page, 0x80, 15 + n, 0);
};
const shiftDown = (page: Page) => mi(page, 0xb0, 49, 127);
const shiftUp = (page: Page) => mi(page, 0xb0, 49, 0);

async function boot(page: Page) {
  await page.goto("/");
  await page.waitForTimeout(2500);
}
async function snap(page: Page, name: string) {
  await page.waitForTimeout(250);
  await expect(page.locator("#oled")).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.02 });
}

test("default view", async ({ page }) => {
  await boot(page);
  await snap(page, "01-default");
});

test("global menu (shift+menu)", async ({ page }) => {
  await boot(page);
  await shiftDown(page);
  await tap(page, 50); // Menu
  await shiftUp(page);
  await snap(page, "02-global-menu");
});

test("global menu scrolled", async ({ page }) => {
  await boot(page);
  await shiftDown(page);
  await tap(page, 50);
  await shiftUp(page);
  for (let i = 0; i < 4; i++) await mi(page, 0xb0, 14, 1); // wheel cw
  await snap(page, "03-global-menu-scrolled");
});

test("note/session toggle (menu)", async ({ page }) => {
  await boot(page);
  await tap(page, 50); // Menu = view toggle
  await snap(page, "04-session-toggle");
});

test("shift+step 2", async ({ page }) => {
  await boot(page);
  await shiftDown(page);
  await step(page, 2);
  await snap(page, "05-shift-step2");
  await shiftUp(page);
});

test("shift+step 5", async ({ page }) => {
  await boot(page);
  await shiftDown(page);
  await step(page, 5);
  await snap(page, "06-shift-step5");
  await shiftUp(page);
});

test("shift+step 9", async ({ page }) => {
  await boot(page);
  await shiftDown(page);
  await step(page, 9);
  await snap(page, "07-shift-step9");
  await shiftUp(page);
});

// Track-View resting overview with the bank position strip (Change: OLED bank
// strip). Tapping Note/Session enters Track view; the header's right side shows
// the "you are here in the bank chain" strip (active bank = tall block, others =
// 2px stubs), replacing the old ad-hoc '>>' hints.
test("track view bank strip", async ({ page }) => {
  await boot(page);
  await tap(page, 50); // Note/Session -> Track view (resting overview)
  await snap(page, "08-track-bank-strip");
});
