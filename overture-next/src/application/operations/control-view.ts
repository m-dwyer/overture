import type {
  ControlSurfaceContext,
  HeldSurfaceControl,
} from "../../state/control-surface-context";
import { operationApplied, type OperationResult } from "./types";

export interface ControlViewContext {
  readonly control: ControlSurfaceContext;
}

export function setSurfaceControlHeld(
  context: ControlViewContext,
  control: HeldSurfaceControl,
  held: boolean,
): OperationResult {
  context.control.setSurfaceControlHeld(control, held);
  return operationApplied();
}

export function toggleView(context: ControlViewContext): OperationResult {
  context.control.toggleActiveView();
  return operationApplied();
}
