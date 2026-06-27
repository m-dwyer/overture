import type { ControlInput, ControlMode, ControlState } from "./controls/types";
import type { HostCommand } from "./host-commands";
import type { PlaybackState } from "./playback";
import type { OvertureProject } from "./project";
import type { TrackRoute } from "./track";
import type { TransportState } from "./transport";

export interface CoreState {
  control: ControlState;
  transport: TransportState;
  playback: PlaybackState;
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
  selectedTrackRoute: TrackRoute;
  visibleTrackBank: number;
  controlMode: ControlMode;
  shiftHeld: boolean;
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

export type { HostCommand } from "./host-commands";

export interface OvertureCore {
  init(): void;
  tick(): void;
  applyInput(input: ControlInput): boolean;
  getSnapshot(): CoreSnapshot;
  getSelectedSequenceLength(): number;
  drainHostCommands(): HostCommand[];
  stopPlayback(): HostCommand[];
}
