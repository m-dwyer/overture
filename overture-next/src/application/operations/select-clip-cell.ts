import type { ClipCellCoordinateInput } from "../../domain/project";
import type { CoreState } from "../types";
import { operationApplied, type OperationResult } from "./types";

export function selectClipCell(state: CoreState, coordinate: ClipCellCoordinateInput): OperationResult {
  state.project.clipCellAt(coordinate);
  state.control.selectClipCell(coordinate);
  return operationApplied();
}
