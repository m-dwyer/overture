import type { DomainIntent } from "../../intents/types";
import type {
  ControlInput,
  ControlInputContext,
  SurfaceAffordance,
} from "../types";

export class GlobalControlContext implements ControlInputContext {
  interpret(input: ControlInput): DomainIntent | null {
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

  affordances(): SurfaceAffordance[] {
    return [
      {
        trigger: { kind: "play" },
        intent: { scope: "transport", kind: "toggle-transport-playback" },
      },
      {
        trigger: { kind: "menu" },
        intent: { scope: "global", kind: "toggle-view" },
      },
    ];
  }
}
