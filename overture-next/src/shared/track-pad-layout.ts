import { SESSION_PAD_COUNT } from "./session-grid";

/**
 * The Track View pad grid plays musical notes by pad position. This neutral
 * layout is shared by control interpretation (pad press -> audition note) and
 * view projection (sounding note -> lit pad) so the pad/note mapping has one
 * home.
 */
export const TRACK_PAD_NOTE_BASE = 60;
export const TRACK_PAD_COUNT = SESSION_PAD_COUNT;

export function noteForTrackPad(padIndex: number): number {
  return TRACK_PAD_NOTE_BASE + padIndex;
}
