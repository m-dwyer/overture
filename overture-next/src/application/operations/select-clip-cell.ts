import type { ClipCellCoordinateInput } from "../../domain/project";
import type { OvertureProject } from "../../state/project";
import { operationApplied, type OperationResult } from "./types";

/** Moves the cursor to a Clip Cell, making it the active clip. */
export function selectClipCell(
  project: OvertureProject,
  coordinate: ClipCellCoordinateInput,
): OperationResult {
  project.selectClip(coordinate);
  return operationApplied();
}
