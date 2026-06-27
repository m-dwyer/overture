import { getSelectedSequence, selectClipCell } from "../project";
import { toggleSequenceStep } from "../sequence";
import { getTrack, trackBankForTrack } from "../track";
import { toggleTransport } from "../transport";
import type { CoreState, HostCommand } from "../types";
import type { DomainIntent } from "./types";

export function applyIntent(intent: DomainIntent, state: CoreState, hostCommands: HostCommand[]): boolean {
  if (intent.kind === "set-shift-held") {
    state.shiftHeld = intent.held;
    return true;
  }
  if (intent.kind === "toggle-transport") {
    const playing = toggleTransport(state.transport);
    if (!playing) hostCommands.push({ kind: "track-note-off", trackIndex: state.selectedTrackIndex, note: 60 });
    return true;
  }
  if (intent.kind === "toggle-session-view") {
    state.sessionView = !state.sessionView;
    return true;
  }
  if (intent.kind === "select-track") {
    const sceneIndex = state.project.selectedClipCell.sceneIndex;
    getTrack(state.project.tracks, intent.trackIndex);
    state.selectedTrackIndex = intent.trackIndex;
    state.visibleTrackBank = trackBankForTrack(intent.trackIndex);
    selectClipCell(state.project, { trackIndex: intent.trackIndex, sceneIndex });
    return true;
  }
  if (intent.kind === "toggle-step") {
    state.selectedStep = intent.stepIndex;
    const sequence = getSelectedSequence(state.project);
    if (sequence) toggleSequenceStep(sequence, intent.stepIndex);
    return true;
  }
  if (intent.kind === "select-clip-cell") {
    getTrack(state.project.tracks, intent.coordinate.trackIndex);
    selectClipCell(state.project, intent.coordinate);
    state.selectedTrackIndex = intent.coordinate.trackIndex;
    state.visibleTrackBank = trackBankForTrack(intent.coordinate.trackIndex);
    return true;
  }
  return false;
}
