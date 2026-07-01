import type { OvertureProject } from "../../state/project";
import { operationApplied, type OperationResult } from "./types";

/**
 * Toggles the Step at stepIndex on the active clip's Sequence. A no-op when the
 * Selected Clip Cell is empty.
 */
export function toggleStep(
  project: OvertureProject,
  stepIndex: number,
): OperationResult {
  project.activeClipEditor()?.toggleStep(stepIndex);
  return operationApplied();
}
