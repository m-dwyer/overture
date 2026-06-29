import type { ControlSurfaceContextSnapshot } from "../../../state/control-surface-context";
import { selectTrackFromRow } from "../../../state/surface-addressing";
import { clipCellCoordinateForSessionPad } from "../../../shared/session-grid";
import type { DomainIntent } from "../../intents/types";
import type { ControlInput } from "../types";

/**
 * Interprets control input in Session View context.
 * Pad presses launch Clip Cells; pad releases and Step buttons do not produce
 * Domain Intents in this view.
 */
export function interpretSessionControl(
  input: ControlInput,
  control: ControlSurfaceContextSnapshot,
): DomainIntent | null {
  if (input.kind === "track-row") {
    return { kind: "select-track", trackIndex: selectTrackFromRow(input.row, control.shiftHeld ? 1 : 0) };
  }
  if (input.kind !== "pad") return null;
  if (!input.held) return null;
  return {
    kind: "launch-clip-cell",
    coordinate: clipCellCoordinateForSessionPad(control.visibleTrackBank, input.padIndex),
  };
}
