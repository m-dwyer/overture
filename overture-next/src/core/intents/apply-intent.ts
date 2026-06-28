import { toggleSequenceStep } from "../sequence";
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
      return applied(state.playback.stop(state.project, state.transport.clock()));
    }
    state.transport.start();
    return applied(state.playback.start(state.project, control.snapshot().selectedClipCell, state.transport.clock()));
  }
  if (intent.kind === "toggle-view") {
    control.toggleView();
    return applied();
  }
  if (intent.kind === "select-track") {
    const sceneIndex = control.snapshot().selectedClipCell.sceneIndex;
    state.project.track(intent.trackIndex);
    state.project.clipCellAt({ trackIndex: intent.trackIndex, sceneIndex });
    control.selectTrack(intent.trackIndex);
    return applied();
  }
  if (intent.kind === "toggle-step") {
    control.selectStep(intent.stepIndex);
    const clip = state.project.clipFor(control.snapshot().selectedClipCell);
    if (clip) toggleSequenceStep(clip.sequence, intent.stepIndex);
    return applied();
  }
  if (intent.kind === "audition-note") {
    const route = state.project.trackRoute(intent.trackIndex);
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
    return applied(state.playback.launchClipCell(state.project, intent.coordinate, state.transport.clock()));
  }
  return { applied: false, hostCommands: [] };
}

function applied(hostCommands: HostCommand[] = []): DomainIntentTransaction {
  return { applied: true, hostCommands };
}

function selectValidatedClipCell(state: CoreState, coordinate: { trackIndex: number; sceneIndex: number }): void {
  state.project.track(coordinate.trackIndex);
  state.project.clipCellAt(coordinate);
  state.control.selectClipCell(coordinate);
}
