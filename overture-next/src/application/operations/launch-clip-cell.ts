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
  const selectedBefore = context.control.snapshot().selectedClipCell;
  const alreadySelected =
    selectedBefore.trackIndex === coordinate.trackIndex &&
    selectedBefore.sceneIndex === coordinate.sceneIndex;

  selectClipCell(context, coordinate);
  if (!alreadySelected) return operationApplied();

  const cell = context.project.clipCellAt(coordinate);
  if (cell.clipId) {
    const trackPlayback = context.playback.snapshot().tracks[cell.trackIndex];
    const alreadyPlayingClip = trackPlayback?.playingClipId === cell.clipId;
    const alreadyQueuedClip = trackPlayback?.queuedClipId === cell.clipId;
    const queuedStopForClip =
      alreadyPlayingClip && Boolean(trackPlayback?.queuedStop);

    if (context.transport.isPlaying() && queuedStopForClip) {
      context.playback.queueClipOnTrack(context.project, coordinate);
      return operationApplied();
    }

    if (alreadyPlayingClip || alreadyQueuedClip) {
      if (context.transport.isPlaying())
        context.playback.queueStopTrack(coordinate.trackIndex);
      else
        return operationApplied(
          context.playback.stopTrack(
            context.project,
            coordinate.trackIndex,
            context.transport.clock(),
          ),
        );
      return operationApplied();
    }

    if (context.transport.isPlaying())
      context.playback.queueClipOnTrack(context.project, coordinate);
    else context.playback.launchClipOnTrack(context.project, coordinate);
    return operationApplied();
  }

  if (context.transport.isPlaying()) {
    context.playback.queueStopTrack(coordinate.trackIndex);
    return operationApplied();
  }

  return operationApplied(
    context.playback.stopTrack(
      context.project,
      coordinate.trackIndex,
      context.transport.clock(),
    ),
  );
}
