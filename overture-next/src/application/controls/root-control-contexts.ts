import type {
  ActiveView,
  ControlSurfaceContextSnapshot,
} from "../../state/control-surface-context";
import { sessionRootControlContext } from "./session";
import { trackRootControlContext } from "./track";
import type { RootControlContext } from "./types";

const rootControlContexts = {
  session: sessionRootControlContext,
  track: trackRootControlContext,
} satisfies Record<ActiveView, RootControlContext>;

export function rootControlContextFor(
  control: ControlSurfaceContextSnapshot,
): RootControlContext {
  return rootControlContexts[control.activeView];
}
