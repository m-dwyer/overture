import type { ClipCellCoordinateInput } from "../../domain/project";
import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import { operationApplied, type OperationResult } from "./types";

export interface SelectClipCellContext {
  readonly control: ControlSurfaceContext;
  readonly project: OvertureProject;
}

export function selectClipCell(
  context: SelectClipCellContext,
  coordinate: ClipCellCoordinateInput,
): OperationResult {
  context.project.clipCellAt(coordinate);
  context.control.selectClipCell(coordinate);
  return operationApplied();
}
