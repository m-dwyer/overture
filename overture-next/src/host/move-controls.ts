// Move hardware MIDI/control map. Host adapters own raw MIDI bytes, CC/note
// numbers, and track/slot channel mapping.

export type Send = (status: number, d1: number, d2: number) => void;

export const NOTE_ON = 0x90;
export const NOTE_OFF = 0x80;
export const CC = 0xb0;

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

export const ROW_CC = [43, 42, 41, 40] as const;
export const STEP_CC0 = 16;
export const KNOB_CC0 = 71;
export const VOLUME_CC = 79;
export const PAD_NOTE0 = 68;
export const PAD_COUNT = 32;
export const PAD_VELOCITY = 110;

export const KNOB_TOUCH0 = 0;
export const MASTER_TOUCH = 8;
export const JOG_TOUCH = 9;

export const SCHWUNG_SLOT_CHANNEL_FIRST = 4;
