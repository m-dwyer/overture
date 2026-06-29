import type { HostCommand } from "../host-commands";

export interface WorkflowResult {
  applied: boolean;
  hostCommands: HostCommand[];
}

export function workflowApplied(hostCommands: HostCommand[] = []): WorkflowResult {
  return { applied: true, hostCommands };
}
