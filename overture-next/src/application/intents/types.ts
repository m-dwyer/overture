import type { HostCommand } from "../host-commands";
import type { ClipCellCoordinate } from "../../domain/project";

export type DomainIntent =
  | { kind: "set-shift-held"; held: boolean }
  | { kind: "toggle-transport" }
  | { kind: "toggle-view" }
  | { kind: "select-track"; trackIndex: number }
  | { kind: "toggle-step"; stepIndex: number }
  | { kind: "audition-note"; held: boolean; note: number; trackIndex: number; velocity: number }
  | { kind: "select-clip-cell"; coordinate: ClipCellCoordinate }
  | { kind: "launch-clip-cell"; coordinate: ClipCellCoordinate };

export interface DomainIntentTransaction {
  applied: boolean;
  hostCommands: HostCommand[];
}
