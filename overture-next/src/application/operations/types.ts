import type { HostCommand } from "../host-commands";

export interface OperationResult {
  applied: boolean;
  hostCommands: HostCommand[];
}

export function operationApplied(
  hostCommands: HostCommand[] = [],
): OperationResult {
  return { applied: true, hostCommands };
}
