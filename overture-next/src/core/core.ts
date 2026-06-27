import type { CoreInput } from "./input";
import { createDefaultProject, getSelectedSequence, selectClipCell } from "./project";
import { DEFAULT_STEP_COUNT, getSequenceStep, toggleSequenceStep } from "./sequence";
import { getTrack, selectTrackFromRow, trackBankForTrack } from "./track";
import { advanceTransport, createTransport, toggleTransport } from "./transport";
import type { CoreState, HostCommand, OvertureCore } from "./types";
import type { LedView, OvertureView, ScreenView } from "../view/types";

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
      selectTrack(selectTrackFromRow(input.row, state.shiftHeld ? 1 : state.visibleTrackBank));
      return true;
    }
    if (input.kind === "step") {
      state.selectedStep = input.step;
      const sequence = getSelectedSequence(state.project);
      if (sequence) toggleSequenceStep(sequence, input.step);
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

  function getView(): OvertureView {
    return {
      screen: getScreenView(),
      leds: getLedView(),
    };
  }

  function getScreenView(): ScreenView {
    return {
      kind: "track",
      title: "OVERTURE NEXT",
      mode: state.sessionView ? "session" : "track",
      selectedTrackIndex: state.selectedTrackIndex,
      playing: state.transport.playing,
      selectedStep: state.selectedStep,
      steps: getStepViews(),
    };
  }

  function getLedView(): LedView {
    const lowerTrack = state.selectedTrackIndex % 4;
    return {
      steps: getStepViews().map((step) => ({
        step: step.index,
        color: step.playhead ? 120 : step.active ? 48 : 0,
      })),
      buttons: [
        ...[0, 1, 2, 3].map((row) => ({ kind: "track-row" as const, row, color: row === lowerTrack ? 120 : 12 })),
        { kind: "play", color: state.transport.playing ? 16 : 4 },
        { kind: "menu", color: state.sessionView ? 44 : 8 },
      ],
    };
  }

  function selectTrack(trackIndex: number): void {
    const sceneIndex = state.project.selectedClipCell.sceneIndex;
    getTrack(state.project.tracks, trackIndex);
    state.selectedTrackIndex = trackIndex;
    state.visibleTrackBank = trackBankForTrack(trackIndex);
    selectClipCell(state.project, { trackIndex, sceneIndex });
  }

  function selectedTrack() {
    return getTrack(state.project.tracks, state.selectedTrackIndex);
  }

  function getSelectedSequenceLength(): number {
    const sequence = getSelectedSequence(state.project);
    return sequence?.length ?? DEFAULT_STEP_COUNT;
  }

  function getStepViews() {
    const sequence = getSelectedSequence(state.project);
    return Array.from({ length: getSelectedSequenceLength() }, (_, index) => {
      const step = sequence ? getSequenceStep(sequence, index) : null;
      return {
        index,
        active: step?.active ?? false,
        selected: index === state.selectedStep,
        playhead: index === state.transport.playhead,
      };
    });
  }

  function drainHostCommands(): HostCommand[] {
    return hostCommands.splice(0);
  }

  return { state, init, tick, applyInput, getView, getSelectedSequenceLength, drainHostCommands };
}
