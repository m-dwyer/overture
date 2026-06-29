import type { OvertureProject } from "../../state/project";
import type { Playback } from "../playback";
import type { TransportState } from "../transport";
import { operationApplied, type OperationResult } from "./types";

export interface StartTransportContext {
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: TransportState;
}

export interface StopTransportContext {
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: TransportState;
}

export function startTransport(
  context: StartTransportContext,
): OperationResult {
  context.transport.start();
  return operationApplied(
    context.playback.injectStep(context.project, context.transport.clock()),
  );
}

export function stopTransport(context: StopTransportContext): OperationResult {
  context.transport.stop();
  return operationApplied(
    context.playback.silenceAll(context.project, context.transport.clock()),
  );
}
