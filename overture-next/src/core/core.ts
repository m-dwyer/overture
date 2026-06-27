import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import { applyIntent } from "./intents/apply-intent";
import { createPlaybackState, getPlayingClip } from "./playback";
import { createDefaultProject, getClipCell, getSequenceForCell } from "./project";
import { DEFAULT_STEP_COUNT, getSequenceStep } from "./sequence";
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
    playback: createPlaybackState(),
    project,
    lastInjectedStep: -1,
  };
  const hostCommands: HostCommand[] = [];

  function init(): void {}

  function tick(): void {
    const nextStep = advanceTransport(state.transport, DEFAULT_STEP_COUNT);
    if (nextStep !== null) {
      injectPlaybackStep(nextStep);
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

  function injectPlaybackStep(step: number): void {
    state.lastInjectedStep = step;
    for (const trackPlayback of state.playback.tracks) {
      const clip = getPlayingClip(state.project, trackPlayback);
      if (!clip) continue;
      const sequenceStep = getSequenceStep(clip.sequence, step % clip.sequence.length);
      if (!sequenceStep?.active) continue;
      hostCommands.push(
        {
          kind: "track-note-on",
          trackIndex: trackPlayback.trackIndex,
          note: sequenceStep.note,
          velocity: sequenceStep.velocity,
        },
        { kind: "track-note-off", trackIndex: trackPlayback.trackIndex, note: sequenceStep.note },
      );
    }
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
