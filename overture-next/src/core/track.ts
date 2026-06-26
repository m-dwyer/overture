import { createDefaultPattern, type Pattern } from "./pattern";

export const TRACK_COUNT = 8;

export interface MoveTrackRoute {
  kind: "move";
  channel: number;
}

export interface TrackState {
  index: number;
  name: string;
  route: MoveTrackRoute;
  pattern: Pattern;
}

export function createTracks(trackCount = TRACK_COUNT): TrackState[] {
  return Array.from({ length: trackCount }, (_, index) => ({
    index,
    name: "Track " + (index + 1),
    route: { kind: "move", channel: index },
    pattern: createDefaultPattern(),
  }));
}

export function selectTrackFromRow(row: number, shiftHeld: boolean): number {
  return row + (shiftHeld ? 4 : 0);
}

export function getTrack(tracks: readonly TrackState[], index: number): TrackState {
  const track = tracks[index];
  if (!track) throw new Error("Missing track " + index);
  return track;
}
