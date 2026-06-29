// Framing prose + reference tables for the full Overture reference manual. Kept
// separate from reference.ts (which owns the captured walkthrough) so the intro,
// cheat-sheet, and glossary can be edited without touching capture logic. Mirrors
// content.ts (the beginner guide) but is intentionally COMPREHENSIVE and
// SELF-CONTAINED: it documents Overture's whole surface and never defers coverage
// to any legacy manual.

import { REF_GUIDE_PATH, REF_HTML_PATH } from "./paths";
import type { CheatRow, DocLink, GlossaryRow } from "./content";
import type { GuideConfig } from "./types";

export const intro = [
  "This is the complete Overture reference: a screenshot-driven tour of every surface — the two views, track and clip selection, step and chord entry, step editing, the parameter banks, effects, automation, drums, scenes, performance, and the global menu. Each figure is produced by the real Overture UI running in the browser emulator, driven through the same MIDI gestures the hardware sends, so the manual always reflects the current build.",
  "Read it top to bottom to learn the instrument, or jump via the contents. A cyan outline with a numbered badge marks each control you press for an action; the numbers match the legend on the action banner. Coloured button and pad fills are Overture's own live LED state. The OLED is always the source of truth — it names the current mode, track, and parameter bank.",
  "Three things live only on real hardware and are noted where they appear: Move's tracks 1–4 sound editing (the firmware owns those voices), the final step of Bake/Export (it writes files through the host), and automation *playback* emission (the edit surface is shown here; emission is verified on device).",
];

// Self-contained: the manual should not depend on any legacy reference for
// coverage.
export const links: DocLink[] = [
  {
    label: "Overture architecture",
    href: "../ARCHITECTURE.md",
    note: "how the active implementation is structured",
  },
];

export const cheatSheet: CheatRow[] = [
  {
    control: "Note/Session",
    gesture: "Tap",
    does: "Toggle Track View and Session View",
  },
  {
    control: "Side buttons 1-4",
    gesture: "Tap (Track View)",
    does: "Select track 1-4 — hold Shift for 5-8",
  },
  {
    control: "Side button",
    gesture: "Hold (Track View)",
    does: "Reveal that track's 16 clips on the step buttons",
  },
  {
    control: "Side buttons",
    gesture: "Tap (Session View)",
    does: "Launch the scene row (Shift = launch at next bar)",
  },
  {
    control: "Pads",
    gesture: "Tap",
    does: "Play notes; pick a drum lane on drum tracks; launch clips in Session View",
  },
  {
    control: "Pads",
    gesture: "Hold several + Step",
    does: "Enter a chord on that step",
  },
  {
    control: "Step 1-16",
    gesture: "Tap",
    does: "Place or clear a hit on the active lane/clip",
  },
  {
    control: "Step 1-16",
    gesture: "Hold",
    does: "Open Step Edit for that step",
  },
  {
    control: "Step + Jog",
    gesture: "Hold + turn",
    does: "Adjust that step's length (Overture)",
  },
  {
    control: "Shift + Step",
    gesture: "Hold + tap",
    does: "Per-step shortcuts",
  },
  {
    control: "Shift + Step 3",
    gesture: "Hold + tap",
    does: "Edit the active track's sound source",
  },
  {
    control: "Jog wheel",
    gesture: "Turn",
    does: "Move through parameter banks",
  },
  {
    control: "K1-K8",
    gesture: "Turn",
    does: "Edit the eight values in the visible bank",
  },
  {
    control: "Copy + pads",
    gesture: "Hold + tap src, then dst (Session)",
    does: "Copy a clip — keep Copy held through both taps (Shift = cut)",
  },
  {
    control: "Delete + pad",
    gesture: "Hold + tap (Session)",
    does: "Clear a clip's notes (Shift = hard-reset)",
  },
  { control: "‹ ›", gesture: "Tap", does: "Page through the clip / loop view" },
  {
    control: "Octave +/-",
    gesture: "Tap",
    does: "Shift the pad octave / transpose",
  },
  {
    control: "Record",
    gesture: "Tap",
    does: "Arm a one-bar count-in, then records automatically — no Play press (tap again to stop)",
  },
  { control: "Play", gesture: "Tap", does: "Start / stop the transport" },
  { control: "Loop", gesture: "Tap / hold", does: "Performance-mode latch" },
  {
    control: "Shift + Note/Session",
    gesture: "Hold + tap",
    does: "Open the Global Menu (save, load, export, settings)",
  },
];

export const glossary: GlossaryRow[] = [
  {
    term: "Track View",
    def: "The detailed editor for one clip: pads, steps, jog, and encoders.",
  },
  {
    term: "Session View",
    def: "The clip launcher: the pad grid is clips across tracks and scene rows.",
  },
  {
    term: "Scene",
    def: "A row of clips — one per track — launched together (A, B, C ...).",
  },
  {
    term: "Clip",
    def: "One pattern on a track. Each track holds 16 clips; the active clip is what Track View edits.",
  },
  {
    term: "Parameter bank",
    def: "A page of eight encoder (K1-K8) parameters shown on the OLED (CLIP, NOTE FX, HARMONY, DELAY, SEQ ARP, ARP IN, AUTO).",
  },
  {
    term: "Drum lane",
    def: "One drum voice on a drum track; its 16 steps are edited on the step row. 32 lanes per drum track.",
  },
  {
    term: "Step Edit",
    def: "The per-step editor opened by holding a step: length, velocity, micro-timing, and trig conditions.",
  },
  {
    term: "Trig condition",
    def: "A per-step rule — Iter (every Nth loop), Prob (chance), Ratch (retrigger) — that varies when a step fires.",
  },
  {
    term: "Performance mode",
    def: "A Loop-latched live layer for momentary loops and repeats over the playing pattern.",
  },
  {
    term: "Bank-position strip",
    def: "The Track-View header tick strip showing how many banks exist and where the jog is (Overture).",
  },
  {
    term: "Sound page",
    def: "The route-aware sound editor opened with Shift + Step 3. Move-routed tracks hand off to Move's editor; Schwung-routed tracks open Overture's module and parameter page.",
  },
  {
    term: "Schwung component",
    def: "One slot in the Schwung Sound page: MIDI FX, Synth, FX 1, or FX 2. Step 1-4 jumps between them while the page is open.",
  },
];

// The full GuideConfig for the reference manual.
export const referenceGuide: GuideConfig = {
  title: "Overture Reference Manual",
  brandName: "OVERTURE",
  brandSub: "REFERENCE MANUAL",
  generateCmd: "pnpm -C web reference:generate",
  editHint:
    "Edit web/tests/manual/reference.ts (walkthrough) and reference-content.ts (intro, cheat-sheet, glossary).",
  mdPath: REF_GUIDE_PATH,
  htmlPath: REF_HTML_PATH,
  intro,
  links,
  cheatSheet,
  glossary,
};
