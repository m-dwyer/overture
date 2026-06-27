export type HostCommand =
  | { kind: "track-note-on"; trackIndex: number; note: number; velocity: number }
  | { kind: "track-note-off"; trackIndex: number; note: number };
