import type { ClipCellCoordinateInput } from "../../domain/project";
import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import type { Playback } from "../playback";
import type { Transport } from "../transport";
import { selectClipCell } from "./select-clip-cell";
import { operationApplied, type OperationResult } from "./types";

export interface LaunchClipCellContext {
  readonly control: ControlSurfaceContext;
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: Transport;
}

export function launchClipCell(
  context: LaunchClipCellContext,
  coordinate: ClipCellCoordinateInput,
): OperationResult {
  const selectedBefore = context.control.snapshot().selectedClipCell;
  const alreadySelected =
    selectedBefore.trackIndex === coordinate.trackIndex &&
    selectedBefore.sceneIndex === coordinate.sceneIndex;

  selectClipCell(context, coordinate);
  if (!alreadySelected) return operationApplied();

  return operationApplied(
    context.playback.requestClipToggle(context.project, coordinate, {
      running: context.transport.isPlaying(),
      clock: context.transport.clock(),
    }),
  );
}
