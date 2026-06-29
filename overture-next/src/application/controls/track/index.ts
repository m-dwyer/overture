import type { ControlSurfaceContextSnapshot } from "../../../state/control-surface-context";
import { selectTrackFromRow } from "../../../state/surface-addressing";
import type { DomainIntent } from "../../intents/types";
import type { ControlInput } from "../types";

const TRACK_PAD_NOTE_BASE = 60;

/**
 * Interprets control input in Track View context.
 * Pad presses and releases both produce audition Domain Intents so note-off can
 * be emitted.
 */
export function interpretTrackViewControl(
  input: ControlInput,
  control: ControlSurfaceContextSnapshot,
): DomainIntent | null {
  if (input.kind === "track-row") {
    return {
      kind: "select-track",
      trackIndex: selectTrackFromRow(
        input.row,
        control.heldControls.includes("shift") ? 1 : 0,
      ),
    };
  }
  if (input.kind === "step")
    return { kind: "toggle-step", stepIndex: input.step };
  if (input.kind !== "pad") return null;
  return {
    kind: "audition-note",
    held: input.held,
    note: TRACK_PAD_NOTE_BASE + input.padIndex,
    trackIndex: control.selectedTrackIndex,
    velocity: input.velocity,
  };
}
