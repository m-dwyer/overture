import type { Page } from "@playwright/test";

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
// functions receive this and never touch the page directly.
export interface Driver {
  page: Page;
  pkt(status: number, d1: number, d2: number): Promise<void>;
  settle(ms?: number): Promise<void>;
  boot(): Promise<void>;
  pressCc(cc: number): Promise<void>;
  holdCc(cc: number): Promise<void>;
  releaseCc(cc: number): Promise<void>;
  tapStep(step: number): Promise<void>;
  tapPad(pad: number): Promise<void>;
  turnJog(detents: number): Promise<void>;
  turnEncoder(encoder: number, detents: number): Promise<void>;
  openGlobalMenu(): Promise<void>;
  selectMenuLabel(labels: string[]): Promise<void>;
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
