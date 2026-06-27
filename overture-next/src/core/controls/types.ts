export type ControlInput =
  | { kind: "shift"; held: boolean }
  | { kind: "play" }
  | { kind: "menu" }
  | { kind: "track-row"; row: number }
  | { kind: "step"; step: number }
  | { kind: "pad"; padIndex: number };

export type ControlMode = "track" | "session";

export interface ControlState {
  selectedTrackIndex: number;
  visibleTrackBank: number;
  controlMode: ControlMode;
  shiftHeld: boolean;
  selectedStep: number;
  selectedClipCell: {
    trackIndex: number;
    sceneIndex: number;
  };
}
