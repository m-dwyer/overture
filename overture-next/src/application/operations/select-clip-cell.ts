import type { ClipCellCoordinate } from "../../domain/project";
import type { CoreState } from "../types";
import { operationApplied, type OperationResult } from "./types";

export function selectClipCell(state: CoreState, coordinate: ClipCellCoordinate): OperationResult {
  state.project.track(coordinate.trackIndex);
  state.project.clipCellAt(coordinate);
  state.control.selectClipCell(coordinate);
  return operationApplied();
}
