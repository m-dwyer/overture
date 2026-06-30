import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import { operationApplied, type OperationResult } from "./types";

export interface AuditionNoteCommand {
  held: boolean;
  padIndex: number;
  note: number;
  trackIndex: number;
  velocity: number;
}

export interface AuditionNoteContext {
  readonly control: ControlSurfaceContext;
  readonly project: OvertureProject;
}

export function auditionNote(
  context: AuditionNoteContext,
  command: AuditionNoteCommand,
): OperationResult {
  context.control.setPadHeld(command.padIndex, command.held);
  const route = context.project.trackRoute(command.trackIndex);
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
