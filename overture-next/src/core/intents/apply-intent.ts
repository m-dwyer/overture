import { getPlayingClip, launchClipCell } from "../playback";
import { getClipCell, getSequenceForCell } from "../project";
import { getSequenceStep, toggleSequenceStep } from "../sequence";
import { getTrack, trackBankForTrack } from "../track";
import { toggleTransport } from "../transport";
import type { CoreState, HostCommand } from "../types";
import type { DomainIntent, DomainIntentTransaction } from "./types";

export function applyIntent(intent: DomainIntent, state: CoreState): DomainIntentTransaction {
  const control = state.control;
  if (intent.kind === "set-shift-held") {
    control.shiftHeld = intent.held;
    return applied();
  }
  if (intent.kind === "toggle-transport") {
    const playing = toggleTransport(state.transport);
    return applied(playing ? [] : stopPlayingClips(state));
  }
  if (intent.kind === "toggle-control-mode") {
    control.controlMode = control.controlMode === "session" ? "track" : "session";
    return applied();
  }
  if (intent.kind === "select-track") {
    const sceneIndex = control.selectedClipCell.sceneIndex;
    getTrack(state.project.tracks, intent.trackIndex);
    getClipCell(state.project, { trackIndex: intent.trackIndex, sceneIndex });
    control.selectedTrackIndex = intent.trackIndex;
    control.visibleTrackBank = trackBankForTrack(intent.trackIndex);
    control.selectedClipCell = { trackIndex: intent.trackIndex, sceneIndex };
    return applied();
  }
  if (intent.kind === "toggle-step") {
    control.selectedStep = intent.stepIndex;
    const sequence = getSequenceForCell(state.project, control.selectedClipCell);
    if (sequence) toggleSequenceStep(sequence, intent.stepIndex);
    return applied();
  }
  if (intent.kind === "select-clip-cell") {
    selectClipCell(state, intent.coordinate);
    return applied();
  }
  if (intent.kind === "launch-clip-cell") {
    selectClipCell(state, intent.coordinate);
    launchClipCell(state.project, state.playback, intent.coordinate);
    return applied();
  }
  return { applied: false, hostCommands: [] };
}

function applied(hostCommands: HostCommand[] = []): DomainIntentTransaction {
  return { applied: true, hostCommands };
}

function selectClipCell(state: CoreState, coordinate: { trackIndex: number; sceneIndex: number }): void {
  const control = state.control;
  getTrack(state.project.tracks, coordinate.trackIndex);
  getClipCell(state.project, coordinate);
  control.selectedClipCell = { ...coordinate };
  control.selectedTrackIndex = coordinate.trackIndex;
  control.visibleTrackBank = trackBankForTrack(coordinate.trackIndex);
}

function stopPlayingClips(state: CoreState): HostCommand[] {
  const hostCommands: HostCommand[] = [];
  for (const trackPlayback of state.playback.tracks) {
    const clip = getPlayingClip(state.project, trackPlayback);
    if (!clip) continue;
    const step = getSequenceStep(clip.sequence, state.transport.playhead % clip.sequence.length);
    if (step?.active) {
      hostCommands.push({ kind: "track-note-off", trackIndex: trackPlayback.trackIndex, note: step.note });
    }
  }
  return hostCommands;
}
