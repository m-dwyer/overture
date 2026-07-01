import type {
  ActiveView,
  ControlSurfaceContextSnapshot,
} from "../../state/control-surface-context";
import type { DomainIntent } from "../intents/types";
import { GlobalControlContext } from "./global";
import { SessionControlContext } from "./session";
import { TrackControlContext } from "./track";
import type {
  ControlInput,
  ControlInputContext,
  SurfaceAffordance,
} from "./types";

export class ControlInputInterpreter {
  private readonly global = new GlobalControlContext();
  private readonly session = new SessionControlContext();
  private readonly track = new TrackControlContext();

  interpret(
    input: ControlInput,
    control: ControlSurfaceContextSnapshot,
  ): DomainIntent | null {
    for (const context of this.contextsFor(control)) {
      const intent = context.interpret(input, control);
      if (intent) return intent;
    }
    return null;
  }

  affordances(control: ControlSurfaceContextSnapshot): SurfaceAffordance[] {
    return this.contextsFor(control).flatMap((context) =>
      context.affordances(control),
    );
  }

  private contextsFor(
    control: ControlSurfaceContextSnapshot,
  ): readonly ControlInputContext[] {
    return [this.global, this.activeViewContext(control.activeView)];
  }

  private activeViewContext(activeView: ActiveView): ControlInputContext {
    switch (activeView) {
      case "session":
        return this.session;
      case "track":
        return this.track;
    }
  }
}
