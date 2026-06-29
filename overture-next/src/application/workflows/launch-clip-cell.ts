import type { ClipCellCoordinate } from "../../domain/project";
import type { CoreState } from "../types";
import { selectClipCell } from "./select-clip-cell";
import { workflowApplied, type WorkflowResult } from "./types";

export function launchClipCell(state: CoreState, coordinate: ClipCellCoordinate): WorkflowResult {
  selectClipCell(state, coordinate);
  return workflowApplied(state.playback.launchClipCell(state.project, coordinate, state.transport.clock()));
}
