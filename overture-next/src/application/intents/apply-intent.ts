import type { CoreState, HostCommand } from "../types";
import { launchClipCell, selectClipCell, startTransport, stopTransport } from "../operations";
import type { DomainIntent, DomainIntentTransaction } from "./types";

export function applyIntent(intent: DomainIntent, state: CoreState): DomainIntentTransaction {
  const control = state.control;
  if (intent.kind === "set-shift-held") {
    control.setShiftHeld(intent.held);
    return applied();
  }
  if (intent.kind === "toggle-transport") {
    if (state.transport.isPlaying()) return stopTransport(state);
    return startTransport(state);
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
    state.project.toggleSequenceStepAt(control.snapshot().selectedClipCell, intent.stepIndex);
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
    return selectClipCell(state, intent.coordinate);
  }
  if (intent.kind === "launch-clip-cell") {
    return launchClipCell(state, intent.coordinate);
  }
  return { applied: false, hostCommands: [] };
}

function applied(hostCommands: HostCommand[] = []): DomainIntentTransaction {
  return { applied: true, hostCommands };
}
