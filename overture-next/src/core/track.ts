export const TRACK_COUNT = 8;
export const TRACK_BANK_SIZE = 4;

export type TrackRoute =
  | { kind: "move"; moveTrackTarget: number }
  | { kind: "schwung"; schwungChainIndex: number };

export interface TrackState {
  index: number;
  name: string;
  route: TrackRoute;
}

export function createTracks(trackCount = TRACK_COUNT): TrackState[] {
  return Array.from({ length: trackCount }, (_, index) => ({
    index,
    name: "Track " + (index + 1),
    route: createDefaultTrackRoute(index),
  }));
}

export function createDefaultTrackRoute(trackIndex: number): TrackRoute {
  if (trackIndex < TRACK_BANK_SIZE) return { kind: "move", moveTrackTarget: trackIndex };
  return { kind: "schwung", schwungChainIndex: trackIndex - TRACK_BANK_SIZE };
}

export function trackBankForTrack(trackIndex: number): number {
  return Math.floor(trackIndex / TRACK_BANK_SIZE);
}

export function selectTrackFromRow(row: number, bankIndex: number): number {
  return row + bankIndex * TRACK_BANK_SIZE;
}

export function getTrack(tracks: readonly TrackState[], index: number): TrackState {
  const track = tracks[index];
  if (!track) throw new Error("Missing track " + index);
  return track;
}
