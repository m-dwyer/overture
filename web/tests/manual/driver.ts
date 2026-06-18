import type { Page } from "@playwright/test";
import type { Driver } from "./types";

// MIDI status bytes and the fixed CC numbers the tool listens on. These mirror
// the hardware shell's mapping so the generator drives the REAL ui.js the same
// way the device would.
export const CC = 0xb0;
export const NOTE_ON = 0x90;
export const NOTE_OFF = 0x80;
export const SHIFT = 49;
export const MENU = 50;
export const JOG = 14;

// aria-labels the callouts target. Centralised so scenarios and the cheat-sheet
// reference one spelling; annotate() hard-fails if any of these drift from the
// live DOM, which is the contract test.
export const ARIA = {
  noteSession: "Toggle Session / Note",
  shift: "Shift",
  jog: "Jog wheel",
  pad: (n: number) => `Pad ${n}`,
  step: (n: number) => `Step ${n}`,
  track: (n: number) => `Track ${n}`,
  encoder: (n: number) => `Encoder ${n}`,
} as const;

type Ovt = {
  midiIn(status: number, d1: number, d2: number): void;
};

// Build a Driver bound to one page. All helpers are straight ports of the
// original manual-shots helpers, closed over `page`.
export function makeDriver(page: Page): Driver {
  const pkt = (status: number, d1: number, d2: number) =>
    page.evaluate(
      ([s, a, b]) => (globalThis as typeof globalThis & { OVT: Ovt }).OVT.midiIn(s, a, b),
      [status, d1, d2]
    );

  const settle = (ms = 250) => page.waitForTimeout(ms);

  async function boot() {
    await page.goto("/?manual=1");
    await page.waitForFunction(() => Boolean((globalThis as typeof globalThis & { OVT?: unknown }).OVT));
    await settle(2500);
  }

  async function pressCc(cc: number) {
    await pkt(CC, cc, 127);
    await settle(120);
    await pkt(CC, cc, 0);
    await settle();
  }

  async function holdCc(cc: number) {
    await pkt(CC, cc, 127);
    await settle();
  }

  async function releaseCc(cc: number) {
    await pkt(CC, cc, 0);
    await settle();
  }

  async function tapStep(step: number) {
    const note = 15 + step;
    await pkt(NOTE_ON, note, 127);
    await settle(120);
    await pkt(NOTE_OFF, note, 0);
    await settle();
  }

  async function tapPad(pad: number) {
    const note = 67 + pad;
    await pkt(NOTE_ON, note, 110);
    await settle(120);
    await pkt(NOTE_OFF, note, 0);
    await settle();
  }

  async function turnJog(detents: number) {
    const val = detents > 0 ? 1 : 127;
    for (let i = 0; i < Math.abs(detents); i++) await pkt(CC, JOG, val);
    await settle();
  }

  async function turnEncoder(encoder: number, detents: number) {
    const val = detents > 0 ? 1 : 127;
    const cc = 70 + encoder;
    for (let i = 0; i < Math.abs(detents); i++) await pkt(CC, cc, val);
    await settle();
  }

  async function openGlobalMenu() {
    await holdCc(SHIFT);
    await pressCc(MENU);
    await releaseCc(SHIFT);
  }

  async function selectMenuLabel(labels: string[]) {
    await page.evaluate((wanted) => {
      const state = (globalThis as typeof globalThis & { overtureUiState?: Record<string, unknown> }).overtureUiState;
      const items = state?.globalMenuItems as Array<{ label?: string }> | undefined;
      const menu = state?.globalMenuState as { selectedIndex: number } | undefined;
      if (!items || !menu) return;
      const idx = items.findIndex((item) => item.label && wanted.includes(item.label));
      if (idx >= 0) {
        menu.selectedIndex = idx;
        if (state) state.screenDirty = true;
      }
    }, labels);
    await settle();
  }

  async function sessionView(): Promise<boolean> {
    return page.evaluate(() => {
      const state = (globalThis as typeof globalThis & { overtureUiState?: Record<string, unknown> }).overtureUiState;
      return Boolean(state?.sessionView);
    });
  }

  async function redraw() {
    await page.evaluate(() => {
      const state = (globalThis as typeof globalThis & { overtureUiState?: Record<string, unknown> }).overtureUiState;
      if (state) state.screenDirty = true;
    });
    await settle();
  }

  async function enterTrackView() {
    if (await sessionView()) await pressCc(MENU);
    await page.evaluate(() => {
      const state = (globalThis as typeof globalThis & { overtureUiState?: Record<string, unknown> }).overtureUiState;
      if (!state) return;
      state.sessionView = false;
      state.activeTrack = 0;
      state.activeBank = 0;
      state.screenDirty = true;
    });
    await settle();
  }

  async function enterDrumTrackView() {
    await enterTrackView();
    await page.evaluate(() => {
      const state = (globalThis as typeof globalThis & { overtureUiState?: Record<string, unknown> }).overtureUiState;
      if (!state) return;
      state.activeTrack = 0;
      state.activeBank = 0;
      (state.activeDrumLane as number[] | undefined)?.splice(0, 1, 0);
      state.drumStepPage = state.drumStepPage || [];
      (state.drumStepPage as number[])[0] = 0;
      state.screenDirty = true;
    });
    await settle();
  }

  async function enterSessionView() {
    if (!(await sessionView())) await pressCc(MENU);
    await redraw();
  }

  return {
    page,
    pkt,
    settle,
    boot,
    pressCc,
    holdCc,
    releaseCc,
    tapStep,
    tapPad,
    turnJog,
    turnEncoder,
    openGlobalMenu,
    selectMenuLabel,
    enterTrackView,
    enterDrumTrackView,
    enterSessionView,
  };
}
