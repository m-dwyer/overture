import { launchClipCellPlayback, startPlayback, stopPlayback as stopClipPlayback } from "../playback";
import { getClipCell, getClipForCell } from "../project";
import { toggleSequenceStep } from "../sequence";
import { getTrack } from "../track";
import type { CoreState, HostCommand } from "../types";
import type { DomainIntent, DomainIntentTransaction } from "./types";

export function applyIntent(intent: DomainIntent, state: CoreState): DomainIntentTransaction {
  const control = state.control;
  if (intent.kind === "set-shift-held") {
    control.setShiftHeld(intent.held);
    return applied();
  }
  if (intent.kind === "toggle-transport") {
    if (state.transport.isPlaying()) {
      state.transport.stop();
      return applied(stopClipPlayback(state.project, state.playback, state.transport.clock()));
    }
    state.transport.start();
    return applied(startPlayback(state.project, state.playback, control.snapshot().selectedClipCell, state.transport.clock()));
  }
  if (intent.kind === "toggle-control-mode") {
    control.toggleControlMode();
    return applied();
  }
  if (intent.kind === "select-track") {
    const sceneIndex = control.snapshot().selectedClipCell.sceneIndex;
    getTrack(state.project.tracks, intent.trackIndex);
    getClipCell(state.project, { trackIndex: intent.trackIndex, sceneIndex });
    control.selectTrack(intent.trackIndex);
    return applied();
  }
  if (intent.kind === "toggle-step") {
    control.selectStep(intent.stepIndex);
    const clip = getClipForCell(state.project, control.snapshot().selectedClipCell);
    if (clip) toggleSequenceStep(clip.sequence, intent.stepIndex);
    return applied();
  }
  if (intent.kind === "audition-note") {
    const route = getTrack(state.project.tracks, intent.trackIndex).route;
    const hostCommand = intent.held
      ? {
          kind: "track-note-on" as const,
          route,
          trackIndex: intent.trackIndex,
          note: intent.note,
          velocity: intent.velocity,
        }
      : {
          kind: "track-note-off" as const,
          route,
          trackIndex: intent.trackIndex,
          note: intent.note,
        };
    return applied([hostCommand]);
  }
  if (intent.kind === "select-clip-cell") {
    selectValidatedClipCell(state, intent.coordinate);
    return applied();
  }
  if (intent.kind === "launch-clip-cell") {
    selectValidatedClipCell(state, intent.coordinate);
    return applied(launchClipCellPlayback(state.project, state.playback, intent.coordinate, state.transport.clock()));
  }
  return { applied: false, hostCommands: [] };
}

function applied(hostCommands: HostCommand[] = []): DomainIntentTransaction {
  return { applied: true, hostCommands };
}

function selectValidatedClipCell(state: CoreState, coordinate: { trackIndex: number; sceneIndex: number }): void {
  getTrack(state.project.tracks, coordinate.trackIndex);
  getClipCell(state.project, coordinate);
  state.control.selectClipCell(coordinate);
}
