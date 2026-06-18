// Non-figure prose and reference tables for the guide, as data. Kept separate
// from scenarios.ts (which owns the captured walkthrough) so the framing copy,
// cheat-sheet, and glossary can be edited without touching the capture logic.

export const intro = [
  "This guide is a screenshot-driven introduction to Overture's current UI. It is intentionally shorter than the inherited dAVEBOx manual — learn the main surfaces here first, then dive into the references below.",
  "Each screenshot is produced by the real Overture UI running in the browser emulator, so it always reflects the current build. A cyan outline with a numbered badge marks each control you press for the action, and the numbers match the legend on the action banner. Coloured button fills are Overture's own live LED state.",
];

export interface DocLink {
  label: string;
  href: string;
  note: string;
}

// Cross-links (this guide lives in docs/generated/). The full dAVEBOx reference
// link is intentionally omitted for now — it will return once that manual is
// also HTML-generated.
export const links: DocLink[] = [
  { label: "Overture vs dAVEBOx", href: "../OVERTURE-VS-DAVEBOX.md", note: "what this fork changes, and why" },
];

export interface CheatRow {
  control: string;
  gesture: string;
  does: string;
}

export const cheatSheet: CheatRow[] = [
  { control: "Note/Session", gesture: "Tap", does: "Toggle Track View and Session View" },
  { control: "Side buttons 1-4", gesture: "Tap (Track View)", does: "Select track 1-4 — hold Shift for 5-8" },
  { control: "Pads", gesture: "Tap", does: "Play notes, or pick a drum lane on drum tracks" },
  { control: "Step 1-16", gesture: "Tap", does: "Place or clear a hit on the active lane" },
  { control: "Jog wheel", gesture: "Turn", does: "Move through parameter banks" },
  { control: "K1-K8", gesture: "Turn", does: "Edit the eight values in the visible bank" },
  { control: "Shift + Note/Session", gesture: "Hold + tap", does: "Open the Global Menu (save, load, export)" },
];

export interface GlossaryRow {
  term: string;
  def: string;
}

export const glossary: GlossaryRow[] = [
  { term: "Track View", def: "The detailed editor for one clip: pads, steps, jog, and encoders." },
  { term: "Session View", def: "The clip launcher: the pad grid is clips across tracks and scene rows." },
  { term: "Scene", def: "A row of clips — one per track — launched together (A, B, C ...)." },
  { term: "Parameter bank", def: "A page of eight encoder (K1-K8) parameters shown on the OLED." },
  { term: "Drum lane", def: "One drum voice on a drum track; its 16 steps are edited on the step row." },
];
