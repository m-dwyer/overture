import type { CoreState } from "../types";
import { operationApplied, type OperationResult } from "./types";

export interface AuditionNoteCommand {
  held: boolean;
  note: number;
  trackIndex: number;
  velocity: number;
}

export function auditionNote(state: CoreState, command: AuditionNoteCommand): OperationResult {
  const route = state.project.trackRoute(command.trackIndex);
  const hostCommand = command.held
    ? {
        kind: "track-note-on" as const,
        route,
        trackIndex: command.trackIndex,
        note: command.note,
        velocity: command.velocity,
      }
    : {
        kind: "track-note-off" as const,
        route,
        trackIndex: command.trackIndex,
        note: command.note,
      };
  return operationApplied([hostCommand]);
}
