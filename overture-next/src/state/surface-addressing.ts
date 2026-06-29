import { SESSION_TRACK_ROWS } from "../shared/session-grid";

export const TRACK_BANK_SIZE = SESSION_TRACK_ROWS;

export function trackBankForTrack(trackIndex: number): number {
  return Math.floor(trackIndex / TRACK_BANK_SIZE);
}

export function selectTrackFromRow(row: number, bankIndex: number): number {
  return row + bankIndex * TRACK_BANK_SIZE;
}

export function visibleTrackRowsForBank(bankIndex: number): number[] {
  return Array.from({ length: TRACK_BANK_SIZE }, (_, row) =>
    selectTrackFromRow(row, bankIndex),
  );
}
