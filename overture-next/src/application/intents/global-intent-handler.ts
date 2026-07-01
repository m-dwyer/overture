import type { ControlSurfaceContext } from "../../state/control-surface-context";
import { assertNever } from "../../shared/assert-never";
import { intentApplied } from "./transaction";
import type { DomainIntentTransaction, GlobalIntent } from "./types";

export interface GlobalIntentHandler {
  handle(intent: GlobalIntent): DomainIntentTransaction;
}

export function createGlobalIntentHandler(
  control: ControlSurfaceContext,
): GlobalIntentHandler {
  return {
    handle(intent) {
      switch (intent.kind) {
        case "set-surface-control-held":
          control.setSurfaceControlHeld(intent.control, intent.held);
          return intentApplied();
        case "toggle-view":
          control.toggleActiveView();
          return intentApplied();
        default:
          return assertNever(intent);
      }
    },
  };
}
