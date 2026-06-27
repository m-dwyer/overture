import type { ControlInput, ControlMode, ControlState } from "./controls/types";
import type { OvertureProject } from "./project";
import type { TransportState } from "./transport";

export interface CoreState {
  control: ControlState;
  transport: TransportState;
  project: OvertureProject;
  lastInjectedStep: number;
}

export interface CoreSnapshotStep {
  index: number;
  active: boolean;
  note: number | null;
  velocity: number | null;
  selected: boolean;
  playhead: boolean;
}

export interface CoreSnapshotClipCell {
  trackIndex: number;
  sceneIndex: number;
  clipId: string | null;
}

export interface CoreSnapshot {
  selectedTrackIndex: number;
  visibleTrackBank: number;
  controlMode: ControlMode;
  selectedStep: number;
  playing: boolean;
  selectedClipId: string | null;
  selectedClipCell: {
    trackIndex: number;
    sceneIndex: number;
  };
  clipCells: CoreSnapshotClipCell[];
  steps: CoreSnapshotStep[];
}

export type HostCommand =
  | { kind: "track-note-on"; trackIndex: number; note: number; velocity: number }
  | { kind: "track-note-off"; trackIndex: number; note: number };

export interface OvertureCore {
  readonly state: CoreState;
  init(): void;
  tick(): void;
  applyInput(input: ControlInput): boolean;
  getSnapshot(): CoreSnapshot;
  getSelectedSequenceLength(): number;
  drainHostCommands(): HostCommand[];
}
