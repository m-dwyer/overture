import type { HostCommand } from "../host-commands";
import type { ClipCellCoordinate } from "../project";

export type DomainIntent =
  | { kind: "set-shift-held"; held: boolean }
  | { kind: "toggle-transport" }
  | { kind: "toggle-control-mode" }
  | { kind: "select-track"; trackIndex: number }
  | { kind: "toggle-step"; stepIndex: number }
  | { kind: "select-clip-cell"; coordinate: ClipCellCoordinate }
  | { kind: "launch-clip-cell"; coordinate: ClipCellCoordinate };

export interface DomainIntentTransaction {
  applied: boolean;
  hostCommands: HostCommand[];
}
