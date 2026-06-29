import type { TrackRoute } from "../domain/project";
import type { ActiveView, ControlSurfaceContext, ControlSurfaceContextSnapshot } from "../state/control-surface-context";
import type { OvertureProject } from "../state/project";
import type { ControlInput } from "./controls/types";
import type { HostCommand } from "./host-commands";
import type { Playback } from "./playback";
import type { TransportState } from "./transport";

export interface CoreState {
  control: ControlSurfaceContext;
  transport: TransportState;
  playback: Playback;
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
  activeView: ActiveView;
  shiftHeld: boolean;
  selectedStep: number;
  playing: boolean;
  selectedClipId: string | null;
  selectedClipCell: ControlSurfaceContextSnapshot["selectedClipCell"];
  clipCells: readonly CoreSnapshotClipCell[];
  steps: readonly CoreSnapshotStep[];
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
