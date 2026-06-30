import type { ProjectPlaybackReadModel } from "../../state/project";
import type { HostCommand } from "../host-commands";
import type { TransportClock } from "../transport";
import { operationApplied, type OperationResult } from "./types";

interface PlaybackTransportEffects {
  injectStep(
    project: ProjectPlaybackReadModel,
    clock: Readonly<TransportClock>,
  ): HostCommand[];
  silenceAll(
    project: ProjectPlaybackReadModel,
    clock: Readonly<TransportClock>,
  ): HostCommand[];
}

interface TransportControl {
  isPlaying(): boolean;
  start(): void;
  stop(): void;
  clock(): TransportClock;
}

export interface ToggleTransportContext {
  readonly project: ProjectPlaybackReadModel;
  readonly playback: PlaybackTransportEffects;
  readonly transport: TransportControl;
}

export function toggleTransport(
  context: ToggleTransportContext,
): OperationResult {
  if (context.transport.isPlaying()) return stopTransport(context);
  return startTransport(context);
}

function startTransport(context: ToggleTransportContext): OperationResult {
  context.transport.start();
  return operationApplied(
    context.playback.injectStep(context.project, context.transport.clock()),
  );
}

function stopTransport(context: ToggleTransportContext): OperationResult {
  context.transport.stop();
  return operationApplied(
    context.playback.silenceAll(context.project, context.transport.clock()),
  );
}
