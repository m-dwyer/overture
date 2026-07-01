import { DEFAULT_STEP_COUNT, getSequenceStep } from "../domain/sequence";
import type { ControlSurfaceContextSnapshot } from "../state/control-surface-context";
import type {
  ClipCellCoordinate,
  ProjectCoreReadModel,
} from "../state/project";
import type { ControlInputInterpreter } from "./controls/control-input-interpreter";
import type { PlaybackSnapshot } from "./playback";
import type { TransportSnapshot } from "./transport";
import type { CoreSnapshot } from "./types";

export interface CoreReadModelSources {
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
  readonly controlInputInterpreter: Pick<
    ControlInputInterpreter,
    "affordances"
  >;
}

export function buildCoreSnapshot(sources: CoreReadModelSources): CoreSnapshot {
  const control = sources.control.snapshot(sources.project.selectedClipCell());
  const transport = sources.transport.snapshot();
  const playback = sources.playback.snapshot();
  const selectedClipCell = control.selectedClipCell;
  const selectedCell = sources.project.clipCellAt(selectedClipCell);

  return {
    selectedTrackIndex: control.selectedTrackIndex,
    selectedTrackRoute: sources.project.trackRoute(control.selectedTrackIndex),
    trackColours: sources.project.trackColours(),
    visibleTrackBank: control.visibleTrackBank,
    activeView: control.activeView,
    heldControls: control.heldControls,
    playing: transport.playing,
    selectedClipId: selectedCell.clipId,
    selectedClipCell: { ...selectedClipCell },
    heldPads: control.heldPads,
    trackView: control.trackView,
    clipCells: sources.project.clipCellSnapshots(),
    playbackTracks: playback.tracks,
    activeNotes: playback.activeNotes,
    affordances: sources.controlInputInterpreter.affordances(control),
    steps: getSnapshotSteps(sources.project, control, transport),
  };
}

export function selectedSequenceLength(sources: CoreReadModelSources): number {
  const control = sources.control.snapshot(sources.project.selectedClipCell());
  const sequence = selectedSequence(sources.project, control);
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
