import type { TrackRoute } from "./track";

interface TrackHostCommand {
  route: TrackRoute;
  trackIndex: number;
}

export type HostCommand =
  | (TrackHostCommand & { kind: "track-note-on"; note: number; velocity: number })
  | (TrackHostCommand & { kind: "track-note-off"; note: number });
