import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import { applyIntent } from "./intents/apply-intent";
import { createDefaultProject, getClipCell, getSequenceForCell } from "./project";
import { DEFAULT_STEP_COUNT, getSequenceStep } from "./sequence";
import { getTrack } from "./track";
import { advanceTransport, createTransport } from "./transport";
import type { CoreSnapshot, CoreState, HostCommand, OvertureCore } from "./types";

export function createOvertureCore(): OvertureCore {
  const project = createDefaultProject();
  const state: CoreState = {
    control: {
      selectedTrackIndex: 0,
      visibleTrackBank: 0,
      controlMode: "track",
      shiftHeld: false,
      selectedStep: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    },
    transport: createTransport(),
    project,
    lastInjectedStep: -1,
  };
  const hostCommands: HostCommand[] = [];

  function init(): void {}

  function tick(): void {
    const sequence = selectedSequence();
    const nextStep = advanceTransport(state.transport, sequence?.length ?? DEFAULT_STEP_COUNT);
    if (nextStep !== null) {
      const step = sequence ? getSequenceStep(sequence, nextStep) : null;
      if (step?.active) injectStep(nextStep);
    }
  }

  function applyInput(input: ControlInput): boolean {
    const intent = interpretControl(input, {
      shiftHeld: state.control.shiftHeld,
      controlMode: state.control.controlMode,
      visibleTrackBank: state.control.visibleTrackBank,
    });
    if (!intent) return false;
    return applyIntent(intent, state, hostCommands);
  }

  function injectStep(step: number): void {
    const sequence = selectedSequence();
    const sequenceStep = sequence ? getSequenceStep(sequence, step) : null;
    if (!sequenceStep) return;
    state.lastInjectedStep = step;
    const track = selectedTrack();
    hostCommands.push(
      { kind: "track-note-on", trackIndex: track.index, note: sequenceStep.note, velocity: sequenceStep.velocity },
      { kind: "track-note-off", trackIndex: track.index, note: sequenceStep.note },
    );
  }

  function getSnapshot(): CoreSnapshot {
    const selectedClipCell = state.control.selectedClipCell;
    const selectedCell = getClipCell(state.project, selectedClipCell);
    return {
      selectedTrackIndex: state.control.selectedTrackIndex,
      visibleTrackBank: state.control.visibleTrackBank,
      controlMode: state.control.controlMode,
      selectedStep: state.control.selectedStep,
      playing: state.transport.playing,
      selectedClipId: selectedCell.clipId,
      selectedClipCell: { ...selectedClipCell },
      clipCells: state.project.clipCells.map((cell) => ({ ...cell })),
      steps: getSnapshotSteps(),
    };
  }

  function selectedTrack() {
    return getTrack(state.project.tracks, state.control.selectedTrackIndex);
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

  return { state, init, tick, applyInput, getSnapshot, getSelectedSequenceLength, drainHostCommands };
}
