import { clipCellCoordinateForSessionPad } from "../../session-grid";
import { selectTrackFromRow } from "../track";
import type { DomainIntent } from "../intents/types";
import type { ControlInput, ControlInterpretContext } from "./types";

export function interpretControl(input: ControlInput, context: ControlInterpretContext): DomainIntent | null {
  if (input.kind === "shift") return { kind: "set-shift-held", held: input.held };
  if (input.kind === "play") return { kind: "toggle-transport" };
  if (input.kind === "menu") return { kind: "toggle-control-mode" };
  if (input.kind === "track-row") {
    return { kind: "select-track", trackIndex: selectTrackFromRow(input.row, context.shiftHeld ? 1 : 0) };
  }
  if (input.kind === "step") return { kind: "toggle-step", stepIndex: input.step };
  if (input.kind === "pad") {
    if (context.controlMode !== "session") return null;
    return {
      kind: "select-clip-cell",
      coordinate: clipCellCoordinateForSessionPad(context.visibleTrackBank, input.padIndex),
    };
  }
  return null;
}
