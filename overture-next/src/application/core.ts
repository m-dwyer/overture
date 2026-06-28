import { DEFAULT_STEP_COUNT, getSequenceStep } from "../domain/sequence";
import { createInitialControlState, type ControlStateSnapshot } from "../state/control-state";
import { createDefaultProject } from "../state/project";
import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import { applyIntent } from "./intents/apply-intent";
import { createPlayback } from "./playback";
import { createTransport, type TransportStateSnapshot } from "./transport";
import type { CoreSnapshot, CoreState, HostCommand, OvertureCore } from "./types";

export function createOvertureCore(): OvertureCore {
  const project = createDefaultProject();
  const state: CoreState = {
    control: createInitialControlState(),
    transport: createTransport(),
    playback: createPlayback(),
    project,
    lastInjectedStep: -1,
  };
  const hostCommands: HostCommand[] = [];

  function init(): void {}

  function tick(): void {
    const transportTick = state.transport.advance(DEFAULT_STEP_COUNT);
    const advance = state.playback.advance(state.project, transportTick);
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
      activeView: control.activeView,
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
    return state.playback.stop(state.project, state.transport.clock());
  }

  function getSelectedSequenceLength(): number {
    return getSelectedSequenceLengthFor(state.control.snapshot());
  }

  return { init, tick, applyInput, getSnapshot, getSelectedSequenceLength, drainHostCommands, stopPlayback };
}
