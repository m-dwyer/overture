import type { ControlStateSnapshot } from "../../../../state/control-state";
import type { DomainIntent } from "../../../intents/types";
import type { ControlInput } from "../../types";

const TRACK_PAD_NOTE_BASE = 60;

export function interpretTrackPadInput(
  input: Extract<ControlInput, { kind: "pad" }>,
  control: ControlStateSnapshot,
): DomainIntent {
  return {
    kind: "audition-note",
    held: input.held,
    note: TRACK_PAD_NOTE_BASE + input.padIndex,
    trackIndex: control.selectedTrackIndex,
    velocity: input.velocity,
  };
}
