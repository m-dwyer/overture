import { clipCellCoordinateForSessionPad } from "../../session-grid";
import { selectTrackFromRow } from "../track";
import type { DomainIntent } from "../intents/types";
import type { ControlInput, ControlState } from "./types";

export function interpretControl(input: ControlInput, control: ControlState): DomainIntent | null {
  if (input.kind === "shift") return { kind: "set-shift-held", held: input.held };
  if (input.kind === "play") return { kind: "toggle-transport" };
  if (input.kind === "menu") return { kind: "toggle-control-mode" };
  if (input.kind === "track-row") return interpretTrackRow(input.row, control);
  if (input.kind === "step") return interpretStep(input.step);
  if (input.kind === "pad") return interpretPad(input.padIndex, control);
  return null;
}

function interpretTrackRow(row: number, control: ControlState): DomainIntent {
  return { kind: "select-track", trackIndex: selectTrackFromRow(row, control.shiftHeld ? 1 : 0) };
}

function interpretStep(step: number): DomainIntent {
  return { kind: "toggle-step", stepIndex: step };
}

function interpretPad(padIndex: number, control: ControlState): DomainIntent | null {
  if (control.controlMode !== "session") return null;
  return {
    kind: "launch-clip-cell",
    coordinate: clipCellCoordinateForSessionPad(control.visibleTrackBank, padIndex),
  };
}
