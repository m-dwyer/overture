import type { ControlAddress } from "../../shared/control-address";
import type { ControlSurfaceContextSnapshot } from "../../state/control-surface-context";
import type { DomainIntent } from "../intents/types";

export type ControlInput =
  | { kind: "shift"; held: boolean }
  | { kind: "play" }
  | { kind: "menu" }
  | { kind: "track-row"; row: number }
  | { kind: "step"; step: number }
  | { kind: "pad"; held: boolean; padIndex: number; velocity: number };

/**
 * A possible Domain Intent a surface control offers in the current context. It
 * carries the real Domain Intent it would produce, so a hint for an intent that
 * does not exist cannot be constructed.
 */
export interface SurfaceAffordance {
  readonly trigger: ControlAddress;
  readonly intent: DomainIntent;
}

/**
 * One control interpretation context: how it interprets a completed Hardware
 * Input, and what it affords for the current context. Both faces are owned
 * together so they cannot drift.
 */
export interface ControlInputContext {
  interpret(
    input: ControlInput,
    control: ControlSurfaceContextSnapshot,
  ): DomainIntent | null;
  affordances(control: ControlSurfaceContextSnapshot): SurfaceAffordance[];
}
