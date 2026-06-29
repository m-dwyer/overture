import { DEFAULT_STEP_COUNT, getSequenceStep } from "../domain/sequence";
import {
  createInitialControlSurfaceContext,
  type ControlSurfaceContextSnapshot,
} from "../state/control-surface-context";
import {
  createDefaultProject,
  type OvertureProject,
  type ProjectCoreReadModel,
} from "../state/project";
import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import { applyIntent, type IntentHandlers } from "./intents/apply-intent";
import {
  auditionNote,
  launchClipCell,
  selectClipCell,
  selectTrack,
  setSurfaceControlHeld,
  startTransport,
  stopTransport,
  toggleSelectedStep,
  toggleView,
} from "./operations";
import { createPlayback, type Playback } from "./playback";
import {
  createTransport,
  type TransportState,
  type TransportStateSnapshot,
} from "./transport";
import type { CoreSnapshot, HostCommand, OvertureCore } from "./types";

export function createOvertureCore(): OvertureCore {
  const project = createDefaultProject();
  const control = createInitialControlSurfaceContext();
  const transport = createTransport();
  const playback = createPlayback();
  playback.seedDefaultScene(project);
  const intentHandlers = createIntentHandlers({
    control,
    project,
    playback,
    transport,
  });
  const hostCommands: HostCommand[] = [];

  function init(): void {}

  function advancePlaybackTick(): void {
    const transportTick = transport.advance(DEFAULT_STEP_COUNT);
    const advance = playback.advanceTick(project, transportTick);
    hostCommands.push(...advance.hostCommands);
  }

  function dispatchControlInput(input: ControlInput): boolean {
    const intent = interpretControl(input, control.snapshot());
    if (!intent) return false;
    const transaction = applyIntent(intent, intentHandlers);
    if (transaction.applied) hostCommands.push(...transaction.hostCommands);
    return transaction.applied;
  }

  function snapshot(): CoreSnapshot {
    return buildCoreSnapshot(
      project,
      control.snapshot(),
      transport.snapshot(),
      playback.snapshot(),
    );
  }

  function drainHostCommands(): HostCommand[] {
    return hostCommands.splice(0);
  }

  function stopPlayback(): HostCommand[] {
    transport.stop();
    return playback.stopAll(project, transport.clock());
  }

  function selectedSequenceLength(): number {
    return getSelectedSequenceLengthFor(project, control.snapshot());
  }

  return {
    init,
    advancePlaybackTick,
    dispatchControlInput,
    snapshot,
    selectedSequenceLength,
    drainHostCommands,
    stopPlayback,
  };
}

interface CoreOwners {
  readonly control: ReturnType<typeof createInitialControlSurfaceContext>;
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: TransportState;
}

function createIntentHandlers({
  control,
  project,
  playback,
  transport,
}: CoreOwners): IntentHandlers {
  return {
    setSurfaceControlHeld(surfaceControl, held) {
      return setSurfaceControlHeld({ control }, surfaceControl, held);
    },
    toggleTransport() {
      if (transport.isPlaying()) {
        return stopTransport({
          project,
          playback,
          transport,
        });
      }
      return startTransport({
        project,
        playback,
        transport,
      });
    },
    toggleView() {
      return toggleView({ control });
    },
    selectTrack(trackIndex) {
      return selectTrack({ control, project }, trackIndex);
    },
    toggleStep(stepIndex) {
      return toggleSelectedStep({ control, project }, stepIndex);
    },
    auditionNote(command) {
      return auditionNote({ project }, command);
    },
    selectClipCell(coordinate) {
      return selectClipCell({ control, project }, coordinate);
    },
    launchClipCell(coordinate) {
      return launchClipCell(
        {
          control,
          project,
          playback,
          transport,
        },
        coordinate,
      );
    },
  };
}

function buildCoreSnapshot(
  project: ProjectCoreReadModel,
  control: ControlSurfaceContextSnapshot,
  transport: TransportStateSnapshot,
  playback: ReturnType<Playback["snapshot"]>,
): CoreSnapshot {
  const selectedClipCell = control.selectedClipCell;
  const selectedCell = project.clipCellAt(selectedClipCell);
  return {
    selectedTrackIndex: control.selectedTrackIndex,
    selectedTrackRoute: project.trackRoute(control.selectedTrackIndex),
    visibleTrackBank: control.visibleTrackBank,
    activeView: control.activeView,
    heldControls: control.heldControls,
    selectedStep: control.selectedStep,
    playing: transport.playing,
    selectedClipId: selectedCell.clipId,
    selectedClipCell: { ...selectedClipCell },
    clipCells: project.clipCellSnapshots(),
    playbackTracks: playback.tracks,
    steps: getSnapshotSteps(project, control, transport),
  };
}

function selectedSequence(
  project: ProjectCoreReadModel,
  control: ControlSurfaceContextSnapshot,
) {
  return project.sequenceFor(control.selectedClipCell);
}

function getSelectedSequenceLengthFor(
  project: ProjectCoreReadModel,
  control: ControlSurfaceContextSnapshot,
): number {
  const sequence = selectedSequence(project, control);
  return sequence?.length ?? DEFAULT_STEP_COUNT;
}

function getSnapshotSteps(
  project: ProjectCoreReadModel,
  control: ControlSurfaceContextSnapshot,
  transport: TransportStateSnapshot,
) {
  const sequence = selectedSequence(project, control);
  return Array.from(
    { length: getSelectedSequenceLengthFor(project, control) },
    (_, index) => {
      const step = sequence ? getSequenceStep(sequence, index) : null;
      return {
        index,
        active: step?.active ?? false,
        note: step?.note ?? null,
        velocity: step?.velocity ?? null,
        selected: index === control.selectedStep,
        playhead: index === transport.playhead,
      };
    },
  );
}
