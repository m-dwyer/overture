import { getClipCell, getSequenceForCell } from "../project";
import { toggleSequenceStep } from "../sequence";
import { getTrack, trackBankForTrack } from "../track";
import { toggleTransport } from "../transport";
import type { CoreState, HostCommand } from "../types";
import type { DomainIntent } from "./types";

export function applyIntent(intent: DomainIntent, state: CoreState, hostCommands: HostCommand[]): boolean {
  const control = state.control;
  if (intent.kind === "set-shift-held") {
    control.shiftHeld = intent.held;
    return true;
  }
  if (intent.kind === "toggle-transport") {
    const playing = toggleTransport(state.transport);
    if (!playing) hostCommands.push({ kind: "track-note-off", trackIndex: control.selectedTrackIndex, note: 60 });
    return true;
  }
  if (intent.kind === "toggle-control-mode") {
    control.controlMode = control.controlMode === "session" ? "track" : "session";
    return true;
  }
  if (intent.kind === "select-track") {
    const sceneIndex = control.selectedClipCell.sceneIndex;
    getTrack(state.project.tracks, intent.trackIndex);
    getClipCell(state.project, { trackIndex: intent.trackIndex, sceneIndex });
    control.selectedTrackIndex = intent.trackIndex;
    control.visibleTrackBank = trackBankForTrack(intent.trackIndex);
    control.selectedClipCell = { trackIndex: intent.trackIndex, sceneIndex };
    return true;
  }
  if (intent.kind === "toggle-step") {
    control.selectedStep = intent.stepIndex;
    const sequence = getSequenceForCell(state.project, control.selectedClipCell);
    if (sequence) toggleSequenceStep(sequence, intent.stepIndex);
    return true;
  }
  if (intent.kind === "select-clip-cell") {
    getTrack(state.project.tracks, intent.coordinate.trackIndex);
    getClipCell(state.project, intent.coordinate);
    control.selectedClipCell = { ...intent.coordinate };
    control.selectedTrackIndex = intent.coordinate.trackIndex;
    control.visibleTrackBank = trackBankForTrack(intent.coordinate.trackIndex);
    return true;
  }
  return false;
}
