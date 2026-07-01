import { DEFAULT_STEP_COUNT, getSequenceStep } from "../domain/sequence";
import type { ControlSurfaceContextSnapshot } from "../state/control-surface-context";
import type { ProjectCoreReadModel } from "../state/project";
import type { SurfaceAffordance } from "./controls/types";
import type { PlaybackSnapshot } from "./playback";
import type { TransportSnapshot } from "./transport";
import type { CoreSnapshot } from "./types";

export interface CoreReadModelSources {
  readonly project: ProjectCoreReadModel;
  readonly control: ControlSurfaceContextSnapshot;
  readonly transport: TransportSnapshot;
  readonly playback: PlaybackSnapshot;
  readonly affordances: readonly SurfaceAffordance[];
}

export function buildCoreSnapshot(sources: CoreReadModelSources): CoreSnapshot {
  const control = sources.control;
  const transport = sources.transport;
  const playback = sources.playback;
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
    affordances: sources.affordances,
    steps: getSnapshotSteps(sources.project, control, transport),
  };
}

export function selectedSequenceLength(
  sources: Pick<CoreReadModelSources, "project" | "control">,
): number {
  const sequence = selectedSequence(sources.project, sources.control);
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
