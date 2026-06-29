import type { TrackRoute } from "../domain/project";

interface TrackHostCommand {
  route: TrackRoute;
  trackIndex: number;
}

export type HostCommand =
  | (TrackHostCommand & { kind: "track-note-on"; note: number; velocity: number })
  | (TrackHostCommand & { kind: "track-note-off"; note: number });
