import type { ProjectPlaybackReadModel } from "../../state/project";
import type { Playback } from "../playback";
import type { Transport } from "../transport";
import { operationApplied, type OperationResult } from "./types";

export interface ToggleTransportPlaybackContext {
  readonly project: ProjectPlaybackReadModel;
  readonly playback: Pick<Playback, "startAt" | "pauseAt">;
  readonly transport: Transport;
}

export function toggleTransportPlayback(
  context: ToggleTransportPlaybackContext,
): OperationResult {
  if (context.transport.isPlaying()) {
    context.transport.stop();
    return operationApplied(
      context.playback.pauseAt(context.project, context.transport.clock()),
    );
  }

  context.transport.start();
  return operationApplied(
    context.playback.startAt(context.project, context.transport.clock()),
  );
}
