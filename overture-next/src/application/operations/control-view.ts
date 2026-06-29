import type { CoreState } from "../types";
import { operationApplied, type OperationResult } from "./types";

export function setShiftHeld(state: CoreState, held: boolean): OperationResult {
  state.control.setShiftHeld(held);
  return operationApplied();
}

export function toggleView(state: CoreState): OperationResult {
  state.control.toggleActiveView();
  return operationApplied();
}
