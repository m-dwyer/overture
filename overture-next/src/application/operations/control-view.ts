import type { ControlSurfaceContext } from "../../state/control-surface-context";
import { operationApplied, type OperationResult } from "./types";

export interface ControlViewContext {
  readonly control: ControlSurfaceContext;
}

export function setShiftHeld(context: ControlViewContext, held: boolean): OperationResult {
  context.control.setShiftHeld(held);
  return operationApplied();
}

export function toggleView(context: ControlViewContext): OperationResult {
  context.control.toggleActiveView();
  return operationApplied();
}
