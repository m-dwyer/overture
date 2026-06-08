// The Move hardware control map — the single source of truth for the React shell,
// re-derived from the device's own constants (schwung shared/constants.mjs, as
// mirrored by the old src/shell.ts):
//   buttons/steps/knobs = CC (0xB0); pads = note 0x90/0x80 (68..99);
//   track buttons = CC 43..40 (Track 1..4); knobs = CC 71..78 (relative).
// Steps press as NOTE 16..31 (that's what the tool's _onStepButtons expects);
// CC 16..31 is only the LED address. The tool maps raw pad notes to musical notes
// internally, so the shell only emits raw pad indices.

export type Send = (status: number, d1: number, d2: number) => void;

export const NOTE_ON = 0x90;
export const NOTE_OFF = 0x80;
export const CC = 0xb0;

/** Control-change numbers for nav/transport buttons. */
export const NAV = {
  Shift: 49,
  Menu: 50,
  Back: 51,
  Capture: 52,
  Down: 54,
  Up: 55,
  Undo: 56,
  Loop: 58,
  Copy: 60,
  Left: 62,
  Right: 63,
  Play: 85,
  Rec: 86,
  Mute: 88,
  Sample: 118,
  Delete: 119,
  JogClick: 3,
  JogRotate: 14,
} as const;

export const ROW_CC = [43, 42, 41, 40] as const; // Track 1..4 buttons
export const STEP_CC0 = 16; // Steps 1..16 -> NOTE/LED 16..31
export const KNOB_CC0 = 71; // Encoders 1..8 -> CC 71..78 (relative)
export const PAD_NOTE0 = 68; // Pads 0..31 -> notes 68..99
export const PAD_VELOCITY = 110;

/** Track-strip colours, top→bottom (Track 1..4): blue / magenta / orange / green. */
export const TRACK_COLORS = ["#2840e0", "#ff20c0", "#c85a10", "#30ff50"] as const;
