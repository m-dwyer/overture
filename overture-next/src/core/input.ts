export type CoreInput =
  | { kind: "shift"; held: boolean }
  | { kind: "play" }
  | { kind: "menu" }
  | { kind: "track-row"; row: number }
  | { kind: "step"; step: number };
