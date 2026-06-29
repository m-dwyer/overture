import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import type { Playback } from "../playback";
import type { TransportState } from "../transport";
import { operationApplied, type OperationResult } from "./types";

export interface StartTransportContext {
  readonly control: ControlSurfaceContext;
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: TransportState;
}

export interface StopTransportContext {
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: TransportState;
}

export function startTransport(context: StartTransportContext): OperationResult {
  context.transport.start();
  context.playback.launchClipOnTrackIfIdle(context.project, context.control.snapshot().selectedClipCell);
  return operationApplied(context.playback.injectStep(context.project, context.transport.clock()));
}

export function stopTransport(context: StopTransportContext): OperationResult {
  context.transport.stop();
  return operationApplied(context.playback.stopAll(context.project, context.transport.clock()));
}
