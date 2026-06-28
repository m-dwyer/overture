import { clipCellCoordinateForSessionPad } from "../../../../shared/session-grid";
import type { ControlStateSnapshot } from "../../../../state/control-state";
import type { DomainIntent } from "../../../intents/types";
import type { ControlInput } from "../../types";

export function interpretSessionPadInput(
  input: Extract<ControlInput, { kind: "pad" }>,
  control: ControlStateSnapshot,
): DomainIntent | null {
  if (!input.held) return null;
  return {
    kind: "launch-clip-cell",
    coordinate: clipCellCoordinateForSessionPad(control.visibleTrackBank, input.padIndex),
  };
}
