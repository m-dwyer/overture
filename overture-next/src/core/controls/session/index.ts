import type { ControlStateSnapshot } from "../../control-state";
import type { DomainIntent } from "../../intents/types";
import type { ControlInput } from "../types";
import { interpretSessionPadInput } from "./internal/pads";

/**
 * Interprets Session View pad input as Clip Cell launch requests.
 * Pad releases do not produce Domain Intents.
 */
export function interpretSessionControl(
  input: Extract<ControlInput, { kind: "pad" }>,
  control: ControlStateSnapshot,
): DomainIntent | null {
  return interpretSessionPadInput(input, control);
}
