import { createInitialControlState } from "./control-state";
import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import { applyIntent } from "./intents/apply-intent";
import { createPlaybackState, injectPlaybackStep } from "./playback";
import { createDefaultProject, getClipCell, getSequenceForCell } from "./project";
import { DEFAULT_STEP_COUNT, getSequenceStep } from "./sequence";
import { advanceTransport, createTransport } from "./transport";
import type { CoreSnapshot, CoreState, HostCommand, OvertureCore } from "./types";

export function createOvertureCore(): OvertureCore {
  const project = createDefaultProject();
  const state: CoreState = {
    control: createInitialControlState(),
    transport: createTransport(),
    playback: createPlaybackState(),
    project,
    lastInjectedStep: -1,
  };
  const hostCommands: HostCommand[] = [];

  function init(): void {}

  function tick(): void {
    const nextStep = advanceTransport(state.transport, DEFAULT_STEP_COUNT);
    if (nextStep !== null) {
      state.lastInjectedStep = nextStep;
      hostCommands.push(...injectPlaybackStep(state.project, state.playback, nextStep));
    }
  }

  function applyInput(input: ControlInput): boolean {
    const intent = interpretControl(input, state.control);
    if (!intent) return false;
    const transaction = applyIntent(intent, state);
    if (transaction.applied) hostCommands.push(...transaction.hostCommands);
    return transaction.applied;
  }

  function getSnapshot(): CoreSnapshot {
    const selectedClipCell = state.control.selectedClipCell;
    const selectedCell = getClipCell(state.project, selectedClipCell);
    return {
      selectedTrackIndex: state.control.selectedTrackIndex,
      visibleTrackBank: state.control.visibleTrackBank,
      controlMode: state.control.controlMode,
      shiftHeld: state.control.shiftHeld,
      selectedStep: state.control.selectedStep,
      playing: state.transport.playing,
      selectedClipId: selectedCell.clipId,
      selectedClipCell: { ...selectedClipCell },
      clipCells: state.project.clipCells.map((cell) => ({ ...cell })),
      steps: getSnapshotSteps(),
    };
  }

  function selectedSequence() {
    return getSequenceForCell(state.project, state.control.selectedClipCell);
  }

  function getSelectedSequenceLength(): number {
    const sequence = selectedSequence();
    return sequence?.length ?? DEFAULT_STEP_COUNT;
  }

  function getSnapshotSteps() {
    const sequence = selectedSequence();
    return Array.from({ length: getSelectedSequenceLength() }, (_, index) => {
      const step = sequence ? getSequenceStep(sequence, index) : null;
      return {
        index,
        active: step?.active ?? false,
        note: step?.note ?? null,
        velocity: step?.velocity ?? null,
        selected: index === state.control.selectedStep,
        playhead: index === state.transport.playhead,
      };
    });
  }

  function drainHostCommands(): HostCommand[] {
    return hostCommands.splice(0);
  }

  return { init, tick, applyInput, getSnapshot, getSelectedSequenceLength, drainHostCommands };
}
