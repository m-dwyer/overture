import type { CoreState } from "../types";
import { operationApplied, type OperationResult } from "./types";

export function startTransport(state: CoreState): OperationResult {
  state.transport.start();
  return operationApplied(
    state.playback.start(state.project, state.control.snapshot().selectedClipCell, state.transport.clock()),
  );
}

export function stopTransport(state: CoreState): OperationResult {
  state.transport.stop();
  return operationApplied(state.playback.stop(state.project, state.transport.clock()));
}
