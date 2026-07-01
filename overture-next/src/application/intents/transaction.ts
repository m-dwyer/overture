import type { DomainIntentTransaction } from "./types";
import type { HostCommand } from "../host-commands";

export function intentApplied(
  hostCommands: HostCommand[] = [],
): DomainIntentTransaction {
  return { applied: true, hostCommands };
}
