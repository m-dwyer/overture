import { createInitialControlState, type ControlStateSnapshot } from "./control-state";
import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import { applyIntent } from "./intents/apply-intent";
import { advancePlayback, createPlaybackState, stopPlayback as stopClipPlayback } from "./playback";
import { createDefaultProject } from "./project";
import { DEFAULT_STEP_COUNT, getSequenceStep } from "./sequence";
import { createTransport, type TransportStateSnapshot } from "./transport";
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
    const transportTick = state.transport.advance(DEFAULT_STEP_COUNT);
    const advance = advancePlayback(state.project, state.playback, transportTick);
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
    const transport = state.transport.snapshot();
    const selectedClipCell = control.selectedClipCell;
    const selectedCell = state.project.clipCellAt(selectedClipCell);
    return {
      selectedTrackIndex: control.selectedTrackIndex,
      selectedTrackRoute: state.project.trackRoute(control.selectedTrackIndex),
      visibleTrackBank: control.visibleTrackBank,
      controlMode: control.controlMode,
      shiftHeld: control.shiftHeld,
      selectedStep: control.selectedStep,
      playing: transport.playing,
      selectedClipId: selectedCell.clipId,
      selectedClipCell: { ...selectedClipCell },
      clipCells: state.project.clipCellSnapshots(),
      steps: getSnapshotSteps(control, transport),
    };
  }

  function selectedSequence(control: ControlStateSnapshot) {
    return state.project.sequenceFor(control.selectedClipCell);
  }

  function getSelectedSequenceLengthFor(control: ControlStateSnapshot): number {
    const sequence = selectedSequence(control);
    return sequence?.length ?? DEFAULT_STEP_COUNT;
  }

  function getSnapshotSteps(control: ControlStateSnapshot, transport: TransportStateSnapshot) {
    const sequence = selectedSequence(control);
    return Array.from({ length: getSelectedSequenceLengthFor(control) }, (_, index) => {
      const step = sequence ? getSequenceStep(sequence, index) : null;
      return {
        index,
        active: step?.active ?? false,
        note: step?.note ?? null,
        velocity: step?.velocity ?? null,
        selected: index === control.selectedStep,
        playhead: index === transport.playhead,
      };
    });
  }

  function drainHostCommands(): HostCommand[] {
    return hostCommands.splice(0);
  }

  function stopPlayback(): HostCommand[] {
    state.transport.stop();
    return stopClipPlayback(state.project, state.playback, state.transport.clock());
  }

  function getSelectedSequenceLength(): number {
    return getSelectedSequenceLengthFor(state.control.snapshot());
  }

  return { init, tick, applyInput, getSnapshot, getSelectedSequenceLength, drainHostCommands, stopPlayback };
}
