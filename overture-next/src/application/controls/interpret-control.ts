import type { ControlSurfaceContextSnapshot } from "../../state/control-surface-context";
import type { DomainIntent } from "../intents/types";
import { rootControlContextFor } from "./root-control-contexts";
import type { ControlInput } from "./types";

export function interpretControl(
  input: ControlInput,
  control: ControlSurfaceContextSnapshot,
): DomainIntent | null {
  return (
    interpretExplicitGlobalControl(input) ??
    rootControlContextFor(control).interpret(input, control)
  );
}

function interpretExplicitGlobalControl(
  input: ControlInput,
): DomainIntent | null {
  if (input.kind === "shift")
    return {
      kind: "set-surface-control-held",
      control: "shift",
      held: input.held,
    };
  if (input.kind === "play") return { kind: "toggle-transport-playback" };
  if (input.kind === "menu") return { kind: "toggle-view" };
  return null;
}
