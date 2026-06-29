import type { ClipCellCoordinateInput } from "../../domain/project";
import type { CoreState } from "../types";
import { selectClipCell } from "./select-clip-cell";
import { operationApplied, type OperationResult } from "./types";

export function launchClipCell(state: CoreState, coordinate: ClipCellCoordinateInput): OperationResult {
  selectClipCell(state, coordinate);
  const cell = state.project.clipCellAt(coordinate);
  const hostCommands = cell.clipId
    ? []
    : state.playback.stopTrack(state.project, coordinate.trackIndex, state.transport.clock());
  if (cell.clipId) state.playback.launchClipOnTrack(state.project, coordinate);
  return operationApplied(hostCommands);
}
