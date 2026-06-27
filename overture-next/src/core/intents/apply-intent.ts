import {
  selectClipCell,
  selectStep,
  selectTrack,
  setShiftHeld,
  toggleControlMode,
} from "../control-state";
import { injectPlaybackStep, launchClipCell, stopPlayingClip, stopPlayingClips } from "../playback";
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
    if (!playing) return applied(stopPlayingClips(state.project, state.playback, state.transport));
    startSelectedClipIfPlaybackIdle(state);
    return applied(injectPlaybackStep(state.project, state.playback, state.transport.playhead, state.transport.tick));
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
    const cell = getClipCell(state.project, intent.coordinate);
    const hostCommands = cell.clipId
      ? []
      : stopPlayingClip(state.project, state.playback, state.transport, intent.coordinate.trackIndex);
    launchClipCell(state.project, state.playback, intent.coordinate);
    return applied(hostCommands);
  }
  return { applied: false, hostCommands: [] };
}

function applied(hostCommands: HostCommand[] = []): DomainIntentTransaction {
  return { applied: true, hostCommands };
}

function startSelectedClipIfPlaybackIdle(state: CoreState): void {
  if (state.playback.tracks.some((track) => track.playingClipId)) return;
  const cell = getClipCell(state.project, state.control.selectedClipCell);
  if (cell.clipId) launchClipCell(state.project, state.playback, state.control.selectedClipCell);
}

function selectValidatedClipCell(state: CoreState, coordinate: { trackIndex: number; sceneIndex: number }): void {
  getTrack(state.project.tracks, coordinate.trackIndex);
  getClipCell(state.project, coordinate);
  selectClipCell(state.control, coordinate);
}
