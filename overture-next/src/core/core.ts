import { createInitialControlState, type ControlStateSnapshot } from "./control-state";
import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import { applyIntent } from "./intents/apply-intent";
import { advancePlayback, createPlaybackState, stopPlayback as stopClipPlayback } from "./playback";
import { createDefaultProject, getClipCell, getSequenceForCell } from "./project";
import { DEFAULT_STEP_COUNT, getSequenceStep } from "./sequence";
import { advanceTransport, createTransport, stopTransport } from "./transport";
import type { CoreSnapshot, CoreState, HostCommand, OvertureCore } from "./types";
import { getTrack } from "./track";

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
    const injectedStep = advanceTransport(state.transport, DEFAULT_STEP_COUNT);
    const advance = advancePlayback(state.project, state.playback, { injectedStep, tick: state.transport.tick });
    if (advance.injectedStep !== null) state.lastInjectedStep = advance.injectedStep;
    hostCommands.push(...advance.hostCommands);
  }

  function applyInput(input: ControlInput): boolean {
    const intent = interpretControl(input, state.control.snapshot());
    if (!intent) return false;
    const transaction = applyIntent(intent, state);
    if (transaction.applied) hostCommands.push(...transaction.hostCommands);
    return transaction.applied;
  }

  function getSnapshot(): CoreSnapshot {
    const control = state.control.snapshot();
    const selectedClipCell = control.selectedClipCell;
    const selectedCell = getClipCell(state.project, selectedClipCell);
    return {
      selectedTrackIndex: control.selectedTrackIndex,
      selectedTrackRoute: getTrack(state.project.tracks, control.selectedTrackIndex).route,
      visibleTrackBank: control.visibleTrackBank,
      controlMode: control.controlMode,
      shiftHeld: control.shiftHeld,
      selectedStep: control.selectedStep,
      playing: state.transport.playing,
      selectedClipId: selectedCell.clipId,
      selectedClipCell: { ...selectedClipCell },
      clipCells: state.project.clipCells.map((cell) => ({ ...cell })),
      steps: getSnapshotSteps(control),
    };
  }

  function selectedSequence(control: ControlStateSnapshot) {
    return getSequenceForCell(state.project, control.selectedClipCell);
  }

  function getSelectedSequenceLengthFor(control: ControlStateSnapshot): number {
    const sequence = selectedSequence(control);
    return sequence?.length ?? DEFAULT_STEP_COUNT;
  }

  function getSnapshotSteps(control: ControlStateSnapshot) {
    const sequence = selectedSequence(control);
    return Array.from({ length: getSelectedSequenceLengthFor(control) }, (_, index) => {
      const step = sequence ? getSequenceStep(sequence, index) : null;
      return {
        index,
        active: step?.active ?? false,
        note: step?.note ?? null,
        velocity: step?.velocity ?? null,
        selected: index === control.selectedStep,
        playhead: index === state.transport.playhead,
      };
    });
  }

  function drainHostCommands(): HostCommand[] {
    return hostCommands.splice(0);
  }

  function stopPlayback(): HostCommand[] {
    stopTransport(state.transport);
    return stopClipPlayback(state.project, state.playback, state.transport);
  }

  function getSelectedSequenceLength(): number {
    return getSelectedSequenceLengthFor(state.control.snapshot());
  }

  return { init, tick, applyInput, getSnapshot, getSelectedSequenceLength, drainHostCommands, stopPlayback };
}
