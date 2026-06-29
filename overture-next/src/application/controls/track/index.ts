import type { ControlSurfaceContextSnapshot } from "../../../state/control-surface-context";
import type { DomainIntent } from "../../intents/types";
import type { ControlInput } from "../types";
import { interpretTrackPadInput } from "./internal/pads";

/**
 * Interprets Track View pad input as selected-track note audition.
 * Presses and releases both produce Domain Intents so note-off can be emitted.
 */
export function interpretTrackControl(
  input: Extract<ControlInput, { kind: "pad" }>,
  control: ControlSurfaceContextSnapshot,
): DomainIntent {
  return interpretTrackPadInput(input, control);
}
