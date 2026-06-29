import type { ControlSurfaceContextSnapshot } from "../../state/control-surface-context";
import type { DomainIntent } from "../intents/types";
import { interpretSessionViewControl } from "./session";
import { interpretTrackViewControl } from "./track";
import type { ControlInput } from "./types";

export function interpretControl(
  input: ControlInput,
  control: ControlSurfaceContextSnapshot,
): DomainIntent | null {
  return (
    interpretGlobalControl(input) ?? interpretActiveViewControl(input, control)
  );
}

function interpretGlobalControl(input: ControlInput): DomainIntent | null {
  if (input.kind === "shift")
    return {
      kind: "set-surface-control-held",
      control: "shift",
      held: input.held,
    };
  if (input.kind === "play") return { kind: "toggle-transport" };
  if (input.kind === "menu") return { kind: "toggle-view" };
  return null;
}

function interpretActiveViewControl(
  input: ControlInput,
  control: ControlSurfaceContextSnapshot,
): DomainIntent | null {
  if (control.activeView === "session")
    return interpretSessionViewControl(input, control);
  return interpretTrackViewControl(input, control);
}
