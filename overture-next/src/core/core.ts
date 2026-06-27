import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import { applyIntent } from "./intents/apply-intent";
import { createDefaultProject, getClipCell, getSelectedSequence } from "./project";
import { DEFAULT_STEP_COUNT, getSequenceStep } from "./sequence";
import { getTrack } from "./track";
import { advanceTransport, createTransport } from "./transport";
import type { CoreSnapshot, CoreState, HostCommand, OvertureCore } from "./types";

export function createOvertureCore(): OvertureCore {
  const project = createDefaultProject();
  const state: CoreState = {
    selectedTrackIndex: 0,
    visibleTrackBank: 0,
    sessionView: false,
    shiftHeld: false,
    selectedStep: 0,
    transport: createTransport(),
    project,
    lastInjectedStep: -1,
  };
  const hostCommands: HostCommand[] = [];

  function init(): void {}

  function tick(): void {
    const sequence = getSelectedSequence(state.project);
    const nextStep = advanceTransport(state.transport, sequence?.length ?? DEFAULT_STEP_COUNT);
    if (nextStep !== null) {
      const step = sequence ? getSequenceStep(sequence, nextStep) : null;
      if (step?.active) injectStep(nextStep);
    }
  }

  function applyInput(input: ControlInput): boolean {
    const intent = interpretControl(input, {
      shiftHeld: state.shiftHeld,
      sessionView: state.sessionView,
      visibleTrackBank: state.visibleTrackBank,
    });
    if (!intent) return false;
    return applyIntent(intent, state, hostCommands);
  }

  function injectStep(step: number): void {
    const sequence = getSelectedSequence(state.project);
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
    const selectedClipCell = state.project.selectedClipCell;
    const selectedCell = getClipCell(state.project, selectedClipCell);
    return {
      selectedTrackIndex: state.selectedTrackIndex,
      visibleTrackBank: state.visibleTrackBank,
      sessionView: state.sessionView,
      selectedStep: state.selectedStep,
      playing: state.transport.playing,
      selectedClipId: selectedCell.clipId,
      selectedClipCell: { ...selectedClipCell },
      clipCells: state.project.clipCells.map((cell) => ({ ...cell })),
      steps: getSnapshotSteps(),
    };
  }

  function selectedTrack() {
    return getTrack(state.project.tracks, state.selectedTrackIndex);
  }

  function getSelectedSequenceLength(): number {
    const sequence = getSelectedSequence(state.project);
    return sequence?.length ?? DEFAULT_STEP_COUNT;
  }

  function getSnapshotSteps() {
    const sequence = getSelectedSequence(state.project);
    return Array.from({ length: getSelectedSequenceLength() }, (_, index) => {
      const step = sequence ? getSequenceStep(sequence, index) : null;
      return {
        index,
        active: step?.active ?? false,
        note: step?.note ?? null,
        velocity: step?.velocity ?? null,
        selected: index === state.selectedStep,
        playhead: index === state.transport.playhead,
      };
    });
  }

  function drainHostCommands(): HostCommand[] {
    return hostCommands.splice(0);
  }

  return { state, init, tick, applyInput, getSnapshot, getSelectedSequenceLength, drainHostCommands };
}
