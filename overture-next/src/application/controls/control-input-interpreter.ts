import type {
  ActiveView,
  ControlSurfaceContextSnapshot,
} from "../../state/control-surface-context";
import type { DomainIntent } from "../intents/types";
import { sessionRootControlContext } from "./session";
import { trackRootControlContext } from "./track";
import type {
  ControlInput,
  RootControlContext,
  SurfaceAffordance,
} from "./types";

const rootControlContexts = {
  session: sessionRootControlContext,
  track: trackRootControlContext,
} satisfies Record<ActiveView, RootControlContext>;

export class ControlInputInterpreter {
  interpret(
    input: ControlInput,
    control: ControlSurfaceContextSnapshot,
  ): DomainIntent | null {
    return (
      this.interpretRootIndependentControl(input) ??
      this.activeRootControlContext(control).interpret(input, control)
    );
  }

  affordances(control: ControlSurfaceContextSnapshot): SurfaceAffordance[] {
    return this.activeRootControlContext(control).affordances(control);
  }

  private activeRootControlContext(
    control: ControlSurfaceContextSnapshot,
  ): RootControlContext {
    return rootControlContexts[control.activeView];
  }

  private interpretRootIndependentControl(
    input: ControlInput,
  ): DomainIntent | null {
    if (input.kind === "shift")
      return {
        scope: "global",
        kind: "set-surface-control-held",
        control: "shift",
        held: input.held,
      };
    if (input.kind === "play")
      return { scope: "transport", kind: "toggle-transport-playback" };
    if (input.kind === "menu") return { scope: "global", kind: "toggle-view" };
    return null;
  }
}
