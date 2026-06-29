import type { ClipCellCoordinate } from "../../domain/project";
import type { CoreState } from "../types";
import { workflowApplied, type WorkflowResult } from "./types";

export function selectClipCell(state: CoreState, coordinate: ClipCellCoordinate): WorkflowResult {
  state.project.track(coordinate.trackIndex);
  state.project.clipCellAt(coordinate);
  state.control.selectClipCell(coordinate);
  return workflowApplied();
}
