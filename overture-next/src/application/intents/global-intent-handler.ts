import type { ControlSurfaceContext } from "../../state/control-surface-context";
import { assertNever } from "../../shared/assert-never";
import { intentApplied } from "./transaction";
import type { DomainIntentTransaction, GlobalIntent } from "./types";

export class GlobalIntentHandler {
  constructor(private readonly control: ControlSurfaceContext) {}

  handle(intent: GlobalIntent): DomainIntentTransaction {
    switch (intent.kind) {
      case "set-surface-control-held":
        this.control.setSurfaceControlHeld(intent.control, intent.held);
        return intentApplied();
      case "toggle-view":
        this.control.toggleActiveView();
        return intentApplied();
      default:
        return assertNever(intent);
    }
  }
}
