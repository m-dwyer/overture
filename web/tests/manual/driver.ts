import type { Page } from "@playwright/test";
import {
  CC as M_CC,
  KNOB_CC0,
  NAV,
  NOTE_OFF,
  NOTE_ON,
  PAD_NOTE0,
  PAD_VELOCITY,
  ROW_CC,
  STEP_CC0,
} from "../../src/lib/move-controls";
import type { Driver } from "./types";

// MIDI status byte for control-change messages. Re-exported under the historical
// name `CC` because scenarios.ts imports it; everything else now comes from the
// shell's own control map (src/lib/move-controls.ts) so the generator drives the
// REAL ui.js with the SAME numbers the hardware shell emits — one source of truth.
export const CC = M_CC;

// Convenience aliases (back-compat for any literal callers / readability).
export const SHIFT = NAV.Shift;
export const MENU = NAV.Menu;
export const JOG = NAV.JogRotate;

// Hold long enough to cross the tool's hold-promotion threshold (STEP_HOLD_TICKS
// ≈ 19 ticks ≈ ~200ms at ~94Hz). 500ms is a comfortable margin for a real hold
// (side-button clip reveal, step-edit open).
const HOLD_MS = 500;

// aria-labels the callouts target. Centralised so scenarios and the reference
// reference one spelling; annotate() hard-fails if any of these drift from the
// live DOM, which is the contract test. Button labels mirror ButtonClusters.tsx.
export const ARIA = {
  noteSession: "Toggle Session / Note",
  back: "Back",
  shift: "Shift",
  copy: "Copy",
  delete: "Delete",
  loop: "Loop",
  mute: "Mute",
  undo: "Undo",
  capture: "Capture",
  sampling: "Sampling",
  play: "Play",
  record: "Record",
  octaveUp: "Octave Up / Transpose",
  octaveDown: "Octave Down / Transpose",
  navLeft: "Navigate ‹ / Nudge",
  navRight: "Navigate › / Nudge",
  jog: "Jog wheel",
  jogClick: "Jog click",
  volume: "Volume",
  pad: (n: number) => `Pad ${n}`,
  step: (n: number) => `Step ${n}`,
  track: (n: number) => `Track ${n}`,
  encoder: (n: number) => `Encoder ${n}`,
} as const;

type Ovt = {
  midiIn(status: number, d1: number, d2: number): void;
};

type StateBag = Record<string, unknown> | undefined;

// Build a Driver bound to one page. Navigation is performed with REAL MIDI
// gestures (the same packets the hardware shell sends); overtureUiState is only
// ever READ for waits/asserts, never mutated to move between views — so every
// captured figure reflects the true on-device button choreography.
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

  // --- raw button helpers -----------------------------------------------------
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

  // --- pads / steps / encoders (public API stays 1-based for scenarios) -------
  async function tapStep(step: number) {
    const note = STEP_CC0 + (step - 1);
    await pkt(NOTE_ON, note, 127);
    await settle(120);
    await pkt(NOTE_OFF, note, 0);
    await settle();
  }

  async function tapPad(pad: number) {
    const note = PAD_NOTE0 + (pad - 1);
    await pkt(NOTE_ON, note, PAD_VELOCITY);
    await settle(120);
    await pkt(NOTE_OFF, note, 0);
    await settle();
  }

  async function holdPads(pads: number[]) {
    for (const pad of pads) await pkt(NOTE_ON, PAD_NOTE0 + (pad - 1), PAD_VELOCITY);
    await settle();
  }

  async function releasePads(pads: number[]) {
    for (const pad of pads) await pkt(NOTE_OFF, PAD_NOTE0 + (pad - 1), 0);
    await settle();
  }

  async function turnJog(detents: number) {
    const val = detents > 0 ? 1 : 127;
    for (let i = 0; i < Math.abs(detents); i++) await pkt(CC, JOG, val);
    await settle();
  }

  async function jogClick() {
    await pressCc(NAV.JogClick);
  }

  async function turnEncoder(encoder: number, detents: number) {
    const val = detents > 0 ? 1 : 127;
    const cc = KNOB_CC0 + (encoder - 1);
    for (let i = 0; i < Math.abs(detents); i++) await pkt(CC, cc, val);
    await settle();
  }

  // Curated read of the live emulator for assertions — never used to navigate.
  async function probe() {
    return page.evaluate(() => {
      const s = (globalThis as typeof globalThis & { overtureUiState?: StateBag }).overtureUiState;
      const items = s?.globalMenuItems as Array<{ label?: string }> | undefined;
      const menu = s?.globalMenuState as { selectedIndex: number } | undefined;
      return {
        sessionView: Boolean(s?.sessionView),
        activeTrack: Number(s?.activeTrack ?? -1),
        activeBank: Number(s?.activeBank ?? -1),
        globalMenuOpen: Boolean(s?.globalMenuOpen),
        menuLabel: items && menu ? items[menu.selectedIndex]?.label : undefined,
        recordArmed: Boolean(s?.recordArmed),
        recordCountingIn: Boolean(s?.recordCountingIn),
        oled: (globalThis as typeof globalThis & { __OVT_OLED_TEXT?: string }).__OVT_OLED_TEXT ?? "",
      };
    });
  }

  // --- view state (read-only) -------------------------------------------------
  async function sessionView(): Promise<boolean> {
    return page.evaluate(() => {
      const state = (globalThis as typeof globalThis & { overtureUiState?: StateBag }).overtureUiState;
      return Boolean(state?.sessionView);
    });
  }

  // Force one redraw so a momentary state is captured (render refresh only — does
  // not change view/track/bank; mirrors the integration harness's snapshot()).
  async function redraw() {
    await page.evaluate(() => {
      const state = (globalThis as typeof globalThis & { overtureUiState?: StateBag }).overtureUiState;
      if (state) (state as { screenDirty?: boolean }).screenDirty = true;
    });
    await settle();
  }

  // --- real-gesture navigation ------------------------------------------------
  // Toggle Track View <-> Session View (Note/Session button, CC 50).
  async function toggleNoteSession() {
    await pressCc(NAV.Menu);
  }

  async function enterSessionView() {
    if (!(await sessionView())) await toggleNoteSession();
    await redraw();
  }

  // Select track 1-8 via the side buttons (CC 43..40 = tracks 1..4; Shift banks
  // to 5-8) — Overture's Move-native track-select gesture. A quick tap stays
  // under the hold-reveal threshold, so it only selects the track.
  async function selectTrack(track: number) {
    const t0 = track - 1;
    const cc = ROW_CC[t0 % 4];
    const shift = t0 >= 4;
    if (shift) await holdCc(NAV.Shift);
    await pressCc(cc);
    if (shift) await releaseCc(NAV.Shift);
  }

  // Jump to a bank via Shift + top-row pad (bank b = note 92 + b). This is the
  // real absolute bank selector and is deterministic on a MELODIC track. NOTE:
  // on a DRUM track pad 92 is ALL LANES (not CLIP), so only use this after
  // selecting a melodic track. `selectBank(0)` "homes" a melodic track to CLIP
  // so a following relative turnJog(n) lands on a known bank despite the tool's
  // per-track bank being persisted across scenes.
  const TOP_PAD_NOTE0 = 92;
  async function selectBank(bank: number) {
    await holdCc(NAV.Shift);
    await pkt(NOTE_ON, TOP_PAD_NOTE0 + bank, PAD_VELOCITY);
    await settle(120);
    await pkt(NOTE_OFF, TOP_PAD_NOTE0 + bank, 0);
    await releaseCc(NAV.Shift);
  }

  async function enterTrackView() {
    if (await sessionView()) await toggleNoteSession();
    await selectTrack(1);
    // No bank gesture here: a fresh boot is on bank 0 (CLIP), and the Shift+top-pad
    // jump is context-dependent (on the drum track 1 pad 92 is ALL LANES), so
    // forcing it would pop the ALL-LANES dialog. Melodic scenes call selectBank
    // explicitly after switching to a melodic track.
    await redraw();
  }

  // Drum track: enter Track View on track 1, then pick a drum lane with a real
  // pad press on the left grid (was: a direct activeDrumLane state splice).
  async function selectDrumLane(pad = 1) {
    await tapPad(pad);
  }

  async function enterDrumTrackView() {
    await enterTrackView();
    await selectDrumLane(1);
    await redraw();
  }

  // Hold a track's side button to reveal its 16 clips on the step buttons
  // (Overture's clip-switch gesture). Leaves the button held; pair with
  // selectClipStep() then releaseClipReveal().
  async function holdClipReveal(track: number) {
    const t0 = track - 1;
    const cc = ROW_CC[t0 % 4];
    const shift = t0 >= 4;
    if (shift) await holdCc(NAV.Shift);
    await pkt(CC, cc, 127);
    await settle(HOLD_MS); // cross the hold-promotion threshold → revealClipsTrack
  }

  async function selectClipStep(step: number) {
    await tapStep(step);
  }

  async function releaseClipReveal(track: number) {
    const t0 = track - 1;
    const cc = ROW_CC[t0 % 4];
    const shift = t0 >= 4;
    await pkt(CC, cc, 0);
    if (shift) await releaseCc(NAV.Shift);
    await settle();
  }

  // --- step editing -----------------------------------------------------------
  // Open Step Edit by holding a step button; leaves it held.
  async function stepEditOpen(step: number) {
    await pkt(NOTE_ON, STEP_CC0 + (step - 1), 127);
    await settle(HOLD_MS);
  }

  async function stepEditClose(step: number) {
    await pkt(NOTE_OFF, STEP_CC0 + (step - 1), 0);
    await settle();
  }

  // Hold a step + turn the jog = adjust THAT step's length (Overture change #3).
  async function setStepLength(step: number, detents: number) {
    await stepEditOpen(step);
    await turnJog(detents);
    await stepEditClose(step);
  }

  // Shift + step shortcuts (per-step menu shortcuts).
  async function shiftStep(step: number) {
    await holdCc(NAV.Shift);
    await tapStep(step);
    await releaseCc(NAV.Shift);
  }

  // --- session-view clip ops (Copy 60 / Delete 119 + clip pads) ---------------
  async function copyClip(src: number, dst: number) {
    await holdCc(NAV.Copy);
    await tapPad(src);
    await tapPad(dst);
    await releaseCc(NAV.Copy);
  }

  async function cutClip(src: number, dst: number) {
    await holdCc(NAV.Shift);
    await holdCc(NAV.Copy);
    await tapPad(src);
    await tapPad(dst);
    await releaseCc(NAV.Copy);
    await releaseCc(NAV.Shift);
  }

  async function deleteClip(pad: number) {
    await holdCc(NAV.Delete);
    await tapPad(pad);
    await releaseCc(NAV.Delete);
  }

  // --- transport / navigation -------------------------------------------------
  async function play() {
    await pressCc(NAV.Play);
  }

  async function toggleRecord() {
    await pressCc(NAV.Rec);
  }

  async function pressLoop() {
    await pressCc(NAV.Loop);
  }

  async function pageNav(dir: number) {
    await pressCc(dir > 0 ? NAV.Right : NAV.Left);
  }

  async function sceneNav(dir: number) {
    await pressCc(dir > 0 ? NAV.Up : NAV.Down);
  }

  // --- global menu ------------------------------------------------------------
  async function openGlobalMenu() {
    await holdCc(NAV.Shift);
    await pressCc(NAV.Menu);
    await releaseCc(NAV.Shift);
  }

  // Scroll the open menu to a labelled item with REAL jog rotation (reads the
  // current cursor only to compute the detent count — never writes selection).
  async function selectMenuLabel(labels: string[]) {
    const plan = await page.evaluate((wanted) => {
      const state = (globalThis as typeof globalThis & { overtureUiState?: StateBag }).overtureUiState;
      const items = state?.globalMenuItems as Array<{ label?: string }> | undefined;
      const menu = state?.globalMenuState as { selectedIndex: number } | undefined;
      if (!items || !menu) return null;
      const to = items.findIndex((item) => item.label && wanted.includes(item.label));
      return to >= 0 ? { from: menu.selectedIndex, to } : null;
    }, labels);
    if (!plan) return;
    const delta = plan.to - plan.from;
    const dir = delta >= 0 ? 1 : 127;
    for (let i = 0; i < Math.abs(delta); i++) {
      await pkt(CC, NAV.JogRotate, dir);
      await settle(60);
    }
    await settle();
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
    holdPads,
    releasePads,
    turnJog,
    jogClick,
    turnEncoder,
    toggleNoteSession,
    selectTrack,
    selectBank,
    selectDrumLane,
    holdClipReveal,
    selectClipStep,
    releaseClipReveal,
    stepEditOpen,
    stepEditClose,
    setStepLength,
    shiftStep,
    copyClip,
    cutClip,
    deleteClip,
    play,
    toggleRecord,
    pressLoop,
    pageNav,
    sceneNav,
    openGlobalMenu,
    selectMenuLabel,
    probe,
    enterTrackView,
    enterDrumTrackView,
    enterSessionView,
  };
}
