import { createCoreOwners } from "./core-owners";
import {
  buildCoreSnapshot,
  selectedSequenceLength as readSelectedSequenceLength,
} from "./core-read-model";
import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import { applyCoreIntent } from "./intents/apply-core-intent";
import {
  advanceTransportPlaybackTick,
  stopTransportPlayback,
} from "./transport-playback";
import type { CoreSnapshot, HostCommand, OvertureCore } from "./types";

export function createOvertureCore(): OvertureCore {
  const owners = createCoreOwners();
  const hostCommands: HostCommand[] = [];

  function init(): void {}

  function advancePlaybackTick(): void {
    collectHostCommands(advanceTransportPlaybackTick(owners));
  }

  function dispatchControlInput(input: ControlInput): boolean {
    const intent = interpretControl(
      input,
      owners.control.snapshot(owners.project.selectedClipCell()),
    );
    if (!intent) return false;
    const transaction = applyCoreIntent(intent, owners);
    if (transaction.applied) collectHostCommands(transaction.hostCommands);
    return transaction.applied;
  }

  function snapshot(): CoreSnapshot {
    return buildCoreSnapshot(owners);
  }

  function drainHostCommands(): HostCommand[] {
    return hostCommands.splice(0);
  }

  function stopPlayback(): void {
    collectHostCommands(stopTransportPlayback(owners));
  }

  function selectedSequenceLength(): number {
    return readSelectedSequenceLength(owners);
  }

  function collectHostCommands(commands: readonly HostCommand[]): void {
    hostCommands.push(...commands);
  }

  return {
    init,
    advancePlaybackTick,
    dispatchControlInput,
    snapshot,
    selectedSequenceLength,
    drainHostCommands,
    stopPlayback,
  };
}
