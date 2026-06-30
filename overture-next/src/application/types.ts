import type { TrackRoute } from "../domain/project";
import type {
  ActiveView,
  ControlSurfaceContextSnapshot,
  TrackViewControlContextSnapshot,
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

export interface CoreSnapshotPlaybackTrack {
  trackIndex: number;
  playingClipId: string | null;
  queuedClipId: string | null;
  queuedStop: boolean;
}

export interface CoreSnapshotActiveNote {
  trackIndex: number;
  note: number;
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
  trackView: TrackViewControlContextSnapshot;
  clipCells: readonly CoreSnapshotClipCell[];
  playbackTracks?: readonly CoreSnapshotPlaybackTrack[];
  activeNotes?: readonly CoreSnapshotActiveNote[];
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
  stopPlayback(): void;
}
