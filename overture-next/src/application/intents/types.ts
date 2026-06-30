import type { HostCommand } from "../host-commands";
import type { ClipCellCoordinateInput } from "../../domain/project";
import type { HeldSurfaceControl } from "../../state/control-surface-context";

export type DomainIntent =
  | {
      kind: "set-surface-control-held";
      control: HeldSurfaceControl;
      held: boolean;
    }
  | { kind: "toggle-transport-playback" }
  | { kind: "toggle-view" }
  | { kind: "select-track"; trackIndex: number }
  | { kind: "toggle-step"; stepIndex: number }
  | {
      kind: "audition-note";
      held: boolean;
      note: number;
      trackIndex: number;
      velocity: number;
    }
  | { kind: "select-clip-cell"; coordinate: ClipCellCoordinateInput }
  | { kind: "launch-clip-cell"; coordinate: ClipCellCoordinateInput };

export interface DomainIntentTransaction {
  applied: boolean;
  hostCommands: HostCommand[];
}
