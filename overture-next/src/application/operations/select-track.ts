import type { CoreState } from "../types";
import { operationApplied, type OperationResult } from "./types";

export function selectTrack(state: CoreState, trackIndex: number): OperationResult {
  const sceneIndex = state.control.snapshot().selectedClipCell.sceneIndex;
  state.project.clipCellAt({ trackIndex, sceneIndex });
  state.control.selectTrackPreservingScene(trackIndex);
  return operationApplied();
}
