import type { OvertureProject } from "../../state/project";
import { operationApplied, type OperationResult } from "./types";

/** Moves the cursor to a Track, preserving the current Overture Scene. */
export function selectTrack(
  project: OvertureProject,
  trackIndex: number,
): OperationResult {
  project.selectTrackKeepingScene(trackIndex);
  return operationApplied();
}
