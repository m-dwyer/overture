import {
  selectClipCell,
  selectStep,
  selectTrack,
  setShiftHeld,
  toggleControlMode,
} from "../controls/control-state";
import { launchClipCell, stopPlayingClips } from "../playback";
import { getClipCell, getSequenceForCell } from "../project";
import { toggleSequenceStep } from "../sequence";
import { getTrack } from "../track";
import { toggleTransport } from "../transport";
import type { CoreState, HostCommand } from "../types";
import type { DomainIntent, DomainIntentTransaction } from "./types";

export function applyIntent(intent: DomainIntent, state: CoreState): DomainIntentTransaction {
  const control = state.control;
  if (intent.kind === "set-shift-held") {
    setShiftHeld(control, intent.held);
    return applied();
  }
  if (intent.kind === "toggle-transport") {
    const playing = toggleTransport(state.transport);
    return applied(playing ? [] : stopPlayingClips(state.project, state.playback, state.transport));
  }
  if (intent.kind === "toggle-control-mode") {
    toggleControlMode(control);
    return applied();
  }
  if (intent.kind === "select-track") {
    const sceneIndex = control.selectedClipCell.sceneIndex;
    getTrack(state.project.tracks, intent.trackIndex);
    getClipCell(state.project, { trackIndex: intent.trackIndex, sceneIndex });
    selectTrack(control, intent.trackIndex);
    return applied();
  }
  if (intent.kind === "toggle-step") {
    selectStep(control, intent.stepIndex);
    const sequence = getSequenceForCell(state.project, control.selectedClipCell);
    if (sequence) toggleSequenceStep(sequence, intent.stepIndex);
    return applied();
  }
  if (intent.kind === "select-clip-cell") {
    selectValidatedClipCell(state, intent.coordinate);
    return applied();
  }
  if (intent.kind === "launch-clip-cell") {
    selectValidatedClipCell(state, intent.coordinate);
    launchClipCell(state.project, state.playback, intent.coordinate);
    return applied();
  }
  return { applied: false, hostCommands: [] };
}

function applied(hostCommands: HostCommand[] = []): DomainIntentTransaction {
  return { applied: true, hostCommands };
}

function selectValidatedClipCell(state: CoreState, coordinate: { trackIndex: number; sceneIndex: number }): void {
  getTrack(state.project.tracks, coordinate.trackIndex);
  getClipCell(state.project, coordinate);
  selectClipCell(state.control, coordinate);
}
