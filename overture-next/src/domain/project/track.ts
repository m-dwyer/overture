export const TRACK_COUNT = 8;
export const DEFAULT_MOVE_ROUTE_TRACK_COUNT = 4;

export type TrackRoute =
  | { kind: "move"; moveTrackTarget: number }
  | { kind: "schwung"; schwungChainIndex: number };

export interface Track {
  index: number;
  name: string;
  route: TrackRoute;
}

export function createTracks(trackCount = TRACK_COUNT): Track[] {
  return Array.from({ length: trackCount }, (_, index) => ({
    index,
    name: "Track " + (index + 1),
    route: createDefaultTrackRoute(index),
  }));
}

export function createDefaultTrackRoute(trackIndex: number): TrackRoute {
  if (trackIndex < DEFAULT_MOVE_ROUTE_TRACK_COUNT) return { kind: "move", moveTrackTarget: trackIndex };
  return { kind: "schwung", schwungChainIndex: trackIndex - DEFAULT_MOVE_ROUTE_TRACK_COUNT };
}

export function getTrack(tracks: readonly Track[], index: number): Track {
  const track = tracks[index];
  if (!track) throw new Error("Missing track " + index);
  return track;
}
