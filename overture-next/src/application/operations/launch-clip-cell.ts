import type { ClipCellCoordinateInput } from "../../domain/project";
import type { OvertureProject } from "../../state/project";
import type { Playback } from "../playback";
import type { Transport } from "../transport";
import { selectClipCell } from "./select-clip-cell";
import { operationApplied, type OperationResult } from "./types";

export interface LaunchClipCellContext {
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: Transport;
}

/**
 * Selects the Clip Cell (making it the active clip). A press on the
 * already-active cell also toggles its playback activation at the launch
 * boundary; Playback owns whether that launches, stops, or queues.
 */
export function launchClipCell(
  context: LaunchClipCellContext,
  coordinate: ClipCellCoordinateInput,
): OperationResult {
  const selectedBefore = context.project.selectedClipCell();
  const alreadySelected =
    selectedBefore.trackIndex === coordinate.trackIndex &&
    selectedBefore.sceneIndex === coordinate.sceneIndex;

  selectClipCell(context.project, coordinate);
  if (!alreadySelected) return operationApplied();

  return operationApplied(
    context.playback.requestClipToggle(context.project, coordinate, {
      running: context.transport.isPlaying(),
      clock: context.transport.clock(),
    }),
  );
}
