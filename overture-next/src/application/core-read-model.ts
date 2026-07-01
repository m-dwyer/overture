import { DEFAULT_STEP_COUNT, getSequenceStep } from "../domain/sequence";
import { rootControlContextFor } from "./controls/root-control-contexts";
import type { ControlSurfaceContextSnapshot } from "../state/control-surface-context";
import type {
  ClipCellCoordinate,
  ProjectCoreReadModel,
} from "../state/project";
import type { PlaybackSnapshot } from "./playback";
import type { TransportSnapshot } from "./transport";
import type { CoreSnapshot } from "./types";

export interface CoreReadModelOwners {
  readonly project: ProjectCoreReadModel;
  readonly control: {
    snapshot(
      selectedClipCell: ClipCellCoordinate,
    ): ControlSurfaceContextSnapshot;
  };
  readonly transport: {
    snapshot(): TransportSnapshot;
  };
  readonly playback: {
    snapshot(): PlaybackSnapshot;
  };
}

export function buildCoreSnapshot(owners: CoreReadModelOwners): CoreSnapshot {
  const control = owners.control.snapshot(owners.project.selectedClipCell());
  const transport = owners.transport.snapshot();
  const playback = owners.playback.snapshot();
  const selectedClipCell = control.selectedClipCell;
  const selectedCell = owners.project.clipCellAt(selectedClipCell);

  return {
    selectedTrackIndex: control.selectedTrackIndex,
    selectedTrackRoute: owners.project.trackRoute(control.selectedTrackIndex),
    trackColours: owners.project.trackColours(),
    visibleTrackBank: control.visibleTrackBank,
    activeView: control.activeView,
    heldControls: control.heldControls,
    playing: transport.playing,
    selectedClipId: selectedCell.clipId,
    selectedClipCell: { ...selectedClipCell },
    heldPads: control.heldPads,
    trackView: control.trackView,
    clipCells: owners.project.clipCellSnapshots(),
    playbackTracks: playback.tracks,
    activeNotes: playback.activeNotes,
    affordances: rootControlContextFor(control).affordances(control),
    steps: getSnapshotSteps(owners.project, control, transport),
  };
}

export function selectedSequenceLength(owners: CoreReadModelOwners): number {
  const control = owners.control.snapshot(owners.project.selectedClipCell());
  const sequence = selectedSequence(owners.project, control);
  return sequence?.length ?? DEFAULT_STEP_COUNT;
}

function selectedSequence(
  project: ProjectCoreReadModel,
  control: ControlSurfaceContextSnapshot,
) {
  return project.sequenceFor(control.selectedClipCell);
}

function getSnapshotSteps(
  project: ProjectCoreReadModel,
  control: ControlSurfaceContextSnapshot,
  transport: TransportSnapshot,
) {
  const sequence = selectedSequence(project, control);
  return Array.from(
    { length: selectedSequenceLengthFor(project, control) },
    (_, index) => {
      const step = sequence ? getSequenceStep(sequence, index) : null;
      return {
        index,
        active: step?.active ?? false,
        note: step?.note ?? null,
        velocity: step?.velocity ?? null,
        playhead: index === transport.playhead,
      };
    },
  );
}

function selectedSequenceLengthFor(
  project: ProjectCoreReadModel,
  control: ControlSurfaceContextSnapshot,
): number {
  const sequence = selectedSequence(project, control);
  return sequence?.length ?? DEFAULT_STEP_COUNT;
}
