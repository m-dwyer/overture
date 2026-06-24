import { test, expect } from "@playwright/test";
import { advanceTicks, waitReady } from "./wait";

// Display-fidelity sweep: drive Overture to representative pages and lock a golden
// OLED snapshot of each. Catches render-fidelity regressions (the font-overlap
// class) systematically instead of by luck. OLED-only (the shell's LEDs blink, the
// OLED is static), and we never press Play, so each page is deterministic.

type DisplayPageGlobal = typeof globalThis & {
  OVT: {
    midiIn(status: number, d1: number, d2: number): void;
  };
  overtureUiState?: {
    activeTrack: number;
    activeBank: number;
    sessionView: boolean;
    allLanesConfirmed?: boolean;
    bootSplashTicks?: number;
    stateLoading?: boolean;
  };
};
type Page = import("@playwright/test").Page;

const mi = (page: Page, s: number, d1: number, d2: number) =>
  page.evaluate(([a, b, c]) => (globalThis as DisplayPageGlobal).OVT.midiIn(a, b, c), [s, d1, d2]);

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
const jog = (page: Page, dir: 1 | -1) => mi(page, 0xb0, 14, dir > 0 ? 1 : 127);
const encoderTouch = (page: Page, idx: number, on: boolean) => mi(page, on ? 0x90 : 0x80, idx, on ? 127 : 0);
const encoderTurn = (page: Page, idx: number, dir: 1 | -1) => mi(page, 0xb0, 71 + idx, dir > 0 ? 1 : 127);

const uiState = (page: Page) =>
  page.evaluate(() => {
    const s = (globalThis as DisplayPageGlobal).overtureUiState;
    if (!s) throw new Error("overtureUiState unavailable");
    return {
      activeTrack: s.activeTrack,
      activeBank: s.activeBank,
      sessionView: s.sessionView,
      allLanesConfirmed: !!s.allLanesConfirmed,
    };
  });

async function boot(page: Page) {
  // ?exact pins the 1:1 pixel-exact OLED render so these goldens keep asserting the
  // literal device pixels (the readable default supersamples 8×). This suite IS the
  // device-pixel fidelity lock.
  await page.goto("/?exact");
  await waitReady(page);
}
async function snap(page: Page, name: string) {
  // Flush the redraw for whatever input this scene injected, deterministically, then
  // lock the frame. advanceTicks runs in-stack so the capture can't race the loop.
  await advanceTicks(page, 4);
  await expect(page.locator("#oled")).toHaveScreenshot(`${name}.png`, { maxDiffPixelRatio: 0.02 });
}
async function enterTrackView(page: Page) {
  if ((await uiState(page)).sessionView) {
    await tap(page, 50); // Note/Session
    await advanceTicks(page);
  }
}
async function selectTrack(page: Page, track: 0 | 1 | 2 | 3) {
  await enterTrackView(page);
  await tap(page, 43 - track); // side buttons: CC43=track 1 ... CC40=track 4
  await advanceTicks(page);
}
async function jogToBank(page: Page, bank: number) {
  for (const dir of [1, -1] as const) {
    for (let i = 0; i < 12; i++) {
      const s = await uiState(page);
      if (s.activeBank === bank) return;
      await jog(page, dir);
      await advanceTicks(page);
    }
  }
  const s = await uiState(page);
  throw new Error(`could not reach bank ${bank}; activeBank=${s.activeBank}`);
}
async function showBankOverview(page: Page, bank: number) {
  await jogToBank(page, bank);
  await encoderTouch(page, 0, true);
  await advanceTicks(page);
  await encoderTouch(page, 0, false);
  await advanceTicks(page);
}
async function showTouchedCell(page: Page, bank: number, encoderIdx: number) {
  await jogToBank(page, bank);
  await encoderTurn(page, encoderIdx, 1);
  await advanceTicks(page);
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

test("melodic parameter page sweep", async ({ page }) => {
  await boot(page);
  await selectTrack(page, 1); // track 2 defaults melodic

  await showBankOverview(page, 0);
  await snap(page, "09-param-page-melodic-clip");

  await showBankOverview(page, 2);
  await snap(page, "10-param-page-melodic-harmony");

  await showBankOverview(page, 3);
  await snap(page, "11-param-page-melodic-delay");

  await showBankOverview(page, 4);
  await snap(page, "12-param-page-melodic-seq-arp");

  await showBankOverview(page, 5);
  await snap(page, "13-param-page-melodic-arp-in");
});

test("parameter page touched-cell highlights", async ({ page }) => {
  await boot(page);
  await selectTrack(page, 1); // track 2 defaults melodic

  await showTouchedCell(page, 0, 6);
  await snap(page, "14-param-page-melodic-clip-k7-highlight");

  await showTouchedCell(page, 4, 1);
  await snap(page, "15-param-page-melodic-seq-arp-k2-highlight");
});

test("drum parameter page sweep", async ({ page }) => {
  await boot(page);
  await selectTrack(page, 0); // track 1 defaults drum

  await showBankOverview(page, 0);
  await snap(page, "16-param-page-drum-lane");

  await showBankOverview(page, 7);
  if (!(await uiState(page)).allLanesConfirmed) {
    await mi(page, 0xb0, 3, 127); // jog click confirms ALL LANES overview
    await advanceTicks(page);
  }
  await snap(page, "17-param-page-drum-all-lanes");
});

// OLED readable/exact toggle: default supersamples the 128×64 buffer (readable),
// the toggle flips to 1:1 device pixels, and the choice persists across reloads.
const oledWidth = (page: Page) => page.locator("#oled").evaluate((el) => (el as HTMLCanvasElement).width);

test("oled readable default + exact toggle persists", async ({ page }) => {
  await page.goto("/");
  await waitReady(page);
  expect(await oledWidth(page)).toBe(1024); // readable default (128 × 8)

  await page.getByRole("button", { name: /OLED:/ }).click();
  await expect.poll(() => oledWidth(page)).toBe(128); // exact (1:1 device pixels)

  await page.reload(); // persisted via localStorage
  await waitReady(page);
  expect(await oledWidth(page)).toBe(128);

  // ?exact always forces exact regardless of the stored preference.
  await page.goto("/?exact");
  await waitReady(page);
  expect(await oledWidth(page)).toBe(128);

  // Forced exact mode is a test/display override, not a preference write.
  await page.evaluate(() => localStorage.setItem("ovt:oled-readable", "1"));
  await page.goto("/?exact");
  await waitReady(page);
  expect(await oledWidth(page)).toBe(128);
  await page.goto("/");
  await waitReady(page);
  expect(await oledWidth(page)).toBe(1024);
});
