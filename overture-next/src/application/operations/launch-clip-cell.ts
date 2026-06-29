import type { ClipCellCoordinateInput } from "../../domain/project";
import type { CoreState } from "../types";
import { selectClipCell } from "./select-clip-cell";
import { operationApplied, type OperationResult } from "./types";

export function launchClipCell(state: CoreState, coordinate: ClipCellCoordinateInput): OperationResult {
  selectClipCell(state, coordinate);
  return operationApplied(state.playback.launchClipCell(state.project, coordinate, state.transport.clock()));
}
