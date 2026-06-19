import type { Page } from "@playwright/test";
import type { CheatRow, DocLink, GlossaryRow } from "./content";

// ---- Emitted document model (consumed by emit-markdown / emit-html) ----------
// Section/Shot/Target keep the original shapes so the markdown emitter is a
// straight port; ShotSpec/Scene add the *authoring* layer (data + drive fns).

export interface Target {
  aria: string; // must match a live aria-label in the emulator DOM
  name: string; // human label shown in the callout legend
}

export interface Shot {
  title: string;
  file: string;
  caption: string;
}

export interface Section {
  title: string;
  body: string[];
  shots: Shot[];
}

// ---- Authoring model ---------------------------------------------------------

export type CropMode = "panel" | "oled";

// The imperative engine, bound to one Playwright Page. Scenario drive()/setup()
// functions receive this and never touch the page directly. Navigation is all
// real MIDI gestures; overtureUiState is only ever read, never mutated to move.
export interface Driver {
  page: Page;
  pkt(status: number, d1: number, d2: number): Promise<void>;
  settle(ms?: number): Promise<void>;
  boot(): Promise<void>;
  // raw buttons
  pressCc(cc: number): Promise<void>;
  holdCc(cc: number): Promise<void>;
  releaseCc(cc: number): Promise<void>;
  // pads / steps / encoders (1-based)
  tapStep(step: number): Promise<void>;
  tapPad(pad: number): Promise<void>;
  holdPads(pads: number[]): Promise<void>;
  releasePads(pads: number[]): Promise<void>;
  turnJog(detents: number): Promise<void>;
  jogClick(): Promise<void>;
  turnEncoder(encoder: number, detents: number): Promise<void>;
  // real-gesture navigation
  toggleNoteSession(): Promise<void>;
  selectTrack(track: number): Promise<void>;
  selectBank(bank: number): Promise<void>;
  selectDrumLane(pad?: number): Promise<void>;
  holdClipReveal(track: number): Promise<void>;
  selectClipStep(step: number): Promise<void>;
  releaseClipReveal(track: number): Promise<void>;
  // step editing
  stepEditOpen(step: number): Promise<void>;
  stepEditClose(step: number): Promise<void>;
  setStepLength(step: number, detents: number): Promise<void>;
  shiftStep(step: number): Promise<void>;
  // session-view clip ops
  copyClip(src: number, dst: number): Promise<void>;
  cutClip(src: number, dst: number): Promise<void>;
  deleteClip(pad: number): Promise<void>;
  // transport / navigation
  play(): Promise<void>;
  toggleRecord(): Promise<void>;
  pressLoop(): Promise<void>;
  pageNav(dir: number): Promise<void>;
  sceneNav(dir: number): Promise<void>;
  // global menu
  openGlobalMenu(): Promise<void>;
  selectMenuLabel(labels: string[]): Promise<void>;
  // composite entry points
  enterTrackView(): Promise<void>;
  enterDrumTrackView(): Promise<void>;
  enterSessionView(): Promise<void>;
}

// One captured figure: drive the emulator to a state, annotate it, capture it.
export interface ShotSpec {
  file: string; // "02-track-view.png"
  title: string; // H3 heading + image alt
  action: string; // banner "Do:" line
  showing: string; // banner "Now showing:" line
  caption: string; // prose under the figure
  targets?: Target[]; // numbered callouts → legend + DOM badges
  crop?: CropMode; // "oled" for a tight screen close-up; default "panel"
  drive?: (d: Driver) => Promise<void>; // steps to reach this figure's state
}

// One H2 section: curated prose plus an ordered list of figures. The scene is
// booted once; setup() runs after boot, then each shot's drive() runs in order.
export interface Scene {
  title: string;
  slug: string; // stable anchor for the TOC and cross-links
  body: string[];
  setup?: (d: Driver) => Promise<void>;
  shots: ShotSpec[];
}

// The framing + output target for one generated guide. One config drives both
// emitters, so adding the full-reference manual is a second config + scene list
// — no emitter edits. (DocLink/CheatRow/GlossaryRow stay defined in content.ts.)
export interface GuideConfig {
  title: string; // H1 + <title>
  brandName: string; // header brand word, e.g. "OVERTURE"
  brandSub: string; // header brand sub-line, e.g. "REFERENCE MANUAL"
  generateCmd: string; // the pnpm command that regenerates this doc
  editHint: string; // where to edit the content (scenes/content module)
  mdPath: string; // absolute output path for the markdown
  htmlPath: string; // absolute output path for the HTML
  intro: string[];
  links: DocLink[];
  cheatSheet: CheatRow[];
  glossary: GlossaryRow[];
}
