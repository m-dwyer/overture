import type { CoreState } from "../types";
import { operationApplied, type OperationResult } from "./types";

export function toggleSelectedStep(state: CoreState, stepIndex: number): OperationResult {
  state.control.selectStep(stepIndex);
  state.project.toggleSequenceStepAt(state.control.snapshot().selectedClipCell, stepIndex);
  return operationApplied();
}
