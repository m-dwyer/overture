import type { ClipCellCoordinateInput } from "../../domain/project";
import type { HeldSurfaceControl } from "../../state/control-surface-context";
import type { DomainIntent, DomainIntentTransaction } from "./types";

export interface IntentHandlers {
  setSurfaceControlHeld(control: HeldSurfaceControl, held: boolean): DomainIntentTransaction;
  toggleTransport(): DomainIntentTransaction;
  toggleView(): DomainIntentTransaction;
  selectTrack(trackIndex: number): DomainIntentTransaction;
  toggleStep(stepIndex: number): DomainIntentTransaction;
  auditionNote(command: Extract<DomainIntent, { kind: "audition-note" }>): DomainIntentTransaction;
  selectClipCell(coordinate: ClipCellCoordinateInput): DomainIntentTransaction;
  launchClipCell(coordinate: ClipCellCoordinateInput): DomainIntentTransaction;
}

export function applyIntent(intent: DomainIntent, handlers: IntentHandlers): DomainIntentTransaction {
  if (intent.kind === "set-surface-control-held") {
    return handlers.setSurfaceControlHeld(intent.control, intent.held);
  }
  if (intent.kind === "toggle-transport") {
    return handlers.toggleTransport();
  }
  if (intent.kind === "toggle-view") {
    return handlers.toggleView();
  }
  if (intent.kind === "select-track") {
    return handlers.selectTrack(intent.trackIndex);
  }
  if (intent.kind === "toggle-step") {
    return handlers.toggleStep(intent.stepIndex);
  }
  if (intent.kind === "audition-note") {
    return handlers.auditionNote(intent);
  }
  if (intent.kind === "select-clip-cell") {
    return handlers.selectClipCell(intent.coordinate);
  }
  if (intent.kind === "launch-clip-cell") {
    return handlers.launchClipCell(intent.coordinate);
  }
  return { applied: false, hostCommands: [] };
}
