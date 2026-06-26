export const NOTE_ON = 0x90;
export const NOTE_OFF = 0x80;
export const CC = 0xb0;

export const STEP_NOTE_FIRST = 16;
export const ROW_CC = [43, 42, 41, 40] as const;

export const CC_SHIFT = 49;
export const CC_MENU = 50;
export const CC_PLAY = 85;

export type CoreInput =
  | { kind: "shift"; held: boolean }
  | { kind: "play" }
  | { kind: "menu" }
  | { kind: "track-row"; row: number }
  | { kind: "step"; step: number };

export function parseMoveInput(data: readonly number[], stepCount: number): CoreInput | null {
  const status = (data[0] ?? 0) & 0xf0;
  const d1 = (data[1] ?? 0) | 0;
  const d2 = (data[2] ?? 0) | 0;

  if (status === CC) return parseCc(d1, d2);
  if ((status === NOTE_ON && d2 > 0) || status === NOTE_OFF || (status === NOTE_ON && d2 === 0)) {
    return parseNote(status, d1, d2, stepCount);
  }
  return null;
}

function parseCc(cc: number, value: number): CoreInput | null {
  if (cc === CC_SHIFT) return { kind: "shift", held: value > 0 };
  if (value === 0) return null;
  if (cc === CC_PLAY) return { kind: "play" };
  if (cc === CC_MENU) return { kind: "menu" };
  const row = ROW_CC.indexOf(cc as (typeof ROW_CC)[number]);
  if (row >= 0) return { kind: "track-row", row };
  return null;
}

function parseNote(status: number, note: number, velocity: number, stepCount: number): CoreInput | null {
  if (status !== NOTE_ON || velocity <= 0) return null;
  if (note < STEP_NOTE_FIRST || note >= STEP_NOTE_FIRST + stepCount) return null;
  return { kind: "step", step: note - STEP_NOTE_FIRST };
}
