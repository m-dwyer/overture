import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import { operationApplied, type OperationResult } from "./types";

export interface SelectTrackContext {
  readonly control: ControlSurfaceContext;
  readonly project: OvertureProject;
}

export function selectTrack(context: SelectTrackContext, trackIndex: number): OperationResult {
  const sceneIndex = context.control.snapshot().selectedClipCell.sceneIndex;
  context.project.clipCellAt({ trackIndex, sceneIndex });
  context.control.selectTrackPreservingScene(trackIndex);
  return operationApplied();
}
