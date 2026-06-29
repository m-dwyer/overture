import type { CoreState } from "../types";
import { operationApplied, type OperationResult } from "./types";

export function startTransport(state: CoreState): OperationResult {
  state.transport.start();
  state.playback.launchClipOnTrackIfIdle(state.project, state.control.snapshot().selectedClipCell);
  return operationApplied(state.playback.injectStep(state.project, state.transport.clock()));
}

export function stopTransport(state: CoreState): OperationResult {
  state.transport.stop();
  return operationApplied(state.playback.stopAll(state.project, state.transport.clock()));
}
