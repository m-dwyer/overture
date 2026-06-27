import type { CoreInput } from "./input";
import type { OvertureProject } from "./project";
import type { TransportState } from "./transport";

export interface CoreState {
  selectedTrackIndex: number;
  visibleTrackBank: number;
  sessionView: boolean;
  shiftHeld: boolean;
  selectedStep: number;
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

export interface CoreSnapshot {
  selectedTrackIndex: number;
  visibleTrackBank: number;
  sessionView: boolean;
  selectedStep: number;
  playing: boolean;
  selectedClipId: string | null;
  selectedClipCell: {
    trackIndex: number;
    sceneIndex: number;
  };
  steps: CoreSnapshotStep[];
}

export type HostCommand =
  | { kind: "track-note-on"; trackIndex: number; note: number; velocity: number }
  | { kind: "track-note-off"; trackIndex: number; note: number };

export interface OvertureCore {
  readonly state: CoreState;
  init(): void;
  tick(): void;
  applyInput(input: CoreInput): boolean;
  getSnapshot(): CoreSnapshot;
  getSelectedSequenceLength(): number;
  drainHostCommands(): HostCommand[];
}
