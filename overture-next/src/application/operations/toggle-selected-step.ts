import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import { operationApplied, type OperationResult } from "./types";

export interface ToggleSelectedStepContext {
  readonly control: ControlSurfaceContext;
  readonly project: OvertureProject;
}

export function toggleSelectedStep(context: ToggleSelectedStepContext, stepIndex: number): OperationResult {
  context.control.selectStep(stepIndex);
  context.project.toggleSequenceStepAt(context.control.snapshot().selectedClipCell, stepIndex);
  return operationApplied();
}
