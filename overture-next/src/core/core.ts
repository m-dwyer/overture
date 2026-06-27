import type { CoreInput } from "./input";
import { createDefaultProject, getClipCell, getSelectedSequence, selectClipCell } from "./project";
import { DEFAULT_STEP_COUNT, getSequenceStep, toggleSequenceStep } from "./sequence";
import { getTrack, selectTrackFromRow, TRACK_BANK_SIZE, trackBankForTrack } from "./track";
import { advanceTransport, createTransport, toggleTransport } from "./transport";
import type { CoreSnapshot, CoreState, HostCommand, OvertureCore } from "./types";

const SESSION_SCENE_COLUMNS = 8;

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

  function applyInput(input: CoreInput): boolean {
    if (input.kind === "shift") {
      state.shiftHeld = input.held;
      return true;
    }
    if (input.kind === "play") {
      const playing = toggleTransport(state.transport);
      if (!playing) hostCommands.push({ kind: "track-note-off", trackIndex: state.selectedTrackIndex, note: 60 });
      return true;
    }
    if (input.kind === "menu") {
      state.sessionView = !state.sessionView;
      return true;
    }
    if (input.kind === "track-row") {
      selectTrack(selectTrackFromRow(input.row, state.shiftHeld ? 1 : 0));
      return true;
    }
    if (input.kind === "step") {
      state.selectedStep = input.step;
      const sequence = getSelectedSequence(state.project);
      if (sequence) toggleSequenceStep(sequence, input.step);
      return true;
    }
    if (input.kind === "pad") {
      if (!state.sessionView) return false;
      selectClipCellFromPad(input.padIndex);
      return true;
    }
    return false;
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

  function selectTrack(trackIndex: number): void {
    const sceneIndex = state.project.selectedClipCell.sceneIndex;
    getTrack(state.project.tracks, trackIndex);
    state.selectedTrackIndex = trackIndex;
    state.visibleTrackBank = trackBankForTrack(trackIndex);
    selectClipCell(state.project, { trackIndex, sceneIndex });
  }

  function selectClipCellFromPad(padIndex: number): void {
    const padRowFromBottom = Math.floor(padIndex / SESSION_SCENE_COLUMNS);
    const row = TRACK_BANK_SIZE - 1 - padRowFromBottom;
    const sceneIndex = padIndex % SESSION_SCENE_COLUMNS;
    const trackIndex = selectTrackFromRow(row, state.visibleTrackBank);
    getTrack(state.project.tracks, trackIndex);
    selectClipCell(state.project, { trackIndex, sceneIndex });
    state.selectedTrackIndex = trackIndex;
    state.visibleTrackBank = trackBankForTrack(trackIndex);
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
