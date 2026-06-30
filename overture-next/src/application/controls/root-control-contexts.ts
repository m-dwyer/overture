import type {
  ActiveView,
  ControlSurfaceContextSnapshot,
} from "../../state/control-surface-context";
import type { DomainIntent } from "../intents/types";
import { interpretSessionViewControl } from "./session";
import { interpretTrackViewControl } from "./track";
import type { ControlInput } from "./types";

interface RootControlContext {
  interpret(
    input: ControlInput,
    control: ControlSurfaceContextSnapshot,
  ): DomainIntent | null;
}

const rootControlContexts = {
  session: { interpret: interpretSessionViewControl },
  track: { interpret: interpretTrackViewControl },
} satisfies Record<ActiveView, RootControlContext>;

export function rootControlContextFor(
  control: ControlSurfaceContextSnapshot,
): RootControlContext {
  return rootControlContexts[control.activeView];
}
