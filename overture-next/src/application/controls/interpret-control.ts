import type { ControlStateSnapshot } from "../../state/control-state";
import type { DomainIntent } from "../intents/types";
import { selectTrackFromRow } from "../../state/surface-addressing";
import { interpretSessionControl } from "./session";
import { interpretTrackControl } from "./track";
import type { ControlInput } from "./types";

export function interpretControl(input: ControlInput, control: ControlStateSnapshot): DomainIntent | null {
  if (input.kind === "shift") return { kind: "set-shift-held", held: input.held };
  if (input.kind === "play") return { kind: "toggle-transport" };
  if (input.kind === "menu") return { kind: "toggle-view" };
  if (input.kind === "track-row") return interpretTrackRow(input.row, control);
  if (input.kind === "step") return interpretStep(input.step);
  if (input.kind === "pad") return interpretPad(input, control);
  return null;
}

function interpretTrackRow(row: number, control: ControlStateSnapshot): DomainIntent {
  return { kind: "select-track", trackIndex: selectTrackFromRow(row, control.shiftHeld ? 1 : 0) };
}

function interpretStep(step: number): DomainIntent {
  return { kind: "toggle-step", stepIndex: step };
}

function interpretPad(
  input: Extract<ControlInput, { kind: "pad" }>,
  control: ControlStateSnapshot,
): DomainIntent | null {
  if (control.activeView === "session") return interpretSessionControl(input, control);
  return interpretTrackControl(input, control);
}
