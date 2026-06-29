import type { ControlInput } from "../application/controls/types";

/**
 * Inbound hardware surface boundary. Host adapters own raw Move MIDI parsing;
 * core only receives the Overture control inputs it currently understands.
 */
export interface ControlSurfacePort {
  parseMoveInput(
    data: readonly number[],
    stepCount: number,
  ): ControlInput | null;
}
