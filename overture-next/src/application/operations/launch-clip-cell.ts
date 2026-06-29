import type { ClipCellCoordinateInput } from "../../domain/project";
import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import type { Playback } from "../playback";
import type { TransportState } from "../transport";
import { selectClipCell } from "./select-clip-cell";
import { operationApplied, type OperationResult } from "./types";

export interface LaunchClipCellContext {
  readonly control: ControlSurfaceContext;
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: TransportState;
}

export function launchClipCell(
  context: LaunchClipCellContext,
  coordinate: ClipCellCoordinateInput,
): OperationResult {
  selectClipCell(context, coordinate);
  const cell = context.project.clipCellAt(coordinate);
  const hostCommands = cell.clipId
    ? []
    : context.playback.stopTrack(
        context.project,
        coordinate.trackIndex,
        context.transport.clock(),
      );
  if (cell.clipId)
    context.playback.launchClipOnTrack(context.project, coordinate);
  return operationApplied(hostCommands);
}
