import type { ControlSurfaceContext } from "../state/control-surface-context";
import type { OvertureProject } from "../state/project";
import {
  buildCoreSnapshot,
  selectedSequenceLength as readSelectedSequenceLength,
} from "./core-read-model";
import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import type { DomainIntentRouter } from "./intents/domain-intent-router";
import type { Playback } from "./playback";
import type { Transport } from "./transport";
import {
  advanceTransportPlaybackTick,
  stopTransportPlayback,
} from "./transport-playback";
import type { CoreSnapshot, HostCommand, OvertureCore } from "./types";

export interface OvertureCoreRuntimeDependencies {
  readonly project: OvertureProject;
  readonly control: ControlSurfaceContext;
  readonly transport: Transport;
  readonly playback: Playback;
  readonly domainIntentRouter: DomainIntentRouter;
}

export class OvertureCoreRuntime implements OvertureCore {
  private readonly hostCommands: HostCommand[] = [];

  constructor(private readonly dependencies: OvertureCoreRuntimeDependencies) {}

  init(): void {}

  advancePlaybackTick(): void {
    this.collectHostCommands(
      advanceTransportPlaybackTick({
        project: this.dependencies.project,
        playback: this.dependencies.playback,
        transport: this.dependencies.transport,
      }),
    );
  }

  dispatchControlInput(input: ControlInput): boolean {
    const intent = interpretControl(
      input,
      this.dependencies.control.snapshot(
        this.dependencies.project.selectedClipCell(),
      ),
    );
    if (!intent) return false;
    const transaction = this.dependencies.domainIntentRouter.route(intent);
    if (transaction.applied) this.collectHostCommands(transaction.hostCommands);
    return transaction.applied;
  }

  snapshot(): CoreSnapshot {
    return buildCoreSnapshot({
      project: this.dependencies.project,
      control: this.dependencies.control,
      transport: this.dependencies.transport,
      playback: this.dependencies.playback,
    });
  }

  selectedSequenceLength(): number {
    return readSelectedSequenceLength({
      project: this.dependencies.project,
      control: this.dependencies.control,
      transport: this.dependencies.transport,
      playback: this.dependencies.playback,
    });
  }

  drainHostCommands(): HostCommand[] {
    return this.hostCommands.splice(0);
  }

  stopPlayback(): void {
    this.collectHostCommands(
      stopTransportPlayback({
        project: this.dependencies.project,
        playback: this.dependencies.playback,
        transport: this.dependencies.transport,
      }),
    );
  }

  private collectHostCommands(commands: readonly HostCommand[]): void {
    this.hostCommands.push(...commands);
  }
}
