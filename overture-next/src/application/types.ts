import type { TrackRoute } from "../domain/project";
import type {
  ActiveView,
  ControlSurfaceContextSnapshot,
} from "../state/control-surface-context";
import type { ControlInput } from "./controls/types";
import type { HostCommand } from "./host-commands";

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
  heldControls: ControlSurfaceContextSnapshot["heldControls"];
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
  advancePlaybackTick(): void;
  dispatchControlInput(input: ControlInput): boolean;
  snapshot(): CoreSnapshot;
  selectedSequenceLength(): number;
  drainHostCommands(): HostCommand[];
  stopPlayback(): HostCommand[];
}
