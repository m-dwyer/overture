export type ControlInput =
  | { kind: "shift"; held: boolean }
  | { kind: "play" }
  | { kind: "menu" }
  | { kind: "track-row"; row: number }
  | { kind: "step"; step: number }
  | { kind: "pad"; padIndex: number };

export interface ControlInterpretContext {
  shiftHeld: boolean;
  sessionView: boolean;
  visibleTrackBank: number;
}
