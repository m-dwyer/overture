import type { ControlSurfaceContext } from "../state/control-surface-context";
import type { OvertureProject } from "../state/project";
import {
  buildCoreSnapshot,
  selectedSequenceLength as readSelectedSequenceLength,
} from "./core-read-model";
import type { ControlInputInterpreter } from "./controls/control-input-interpreter";
import type { ControlInput } from "./controls/types";
import type { DomainIntentRouter } from "./intents/domain-intent-router";
import type { Playback } from "./playback";
import type { Transport } from "./transport";
import type { CoreSnapshot, HostCommand, OvertureCore } from "./types";
import { DEFAULT_STEP_COUNT } from "../domain/sequence";

export class OvertureCoreRuntime implements OvertureCore {
  private readonly hostCommands: HostCommand[] = [];

  constructor(
    private readonly project: OvertureProject,
    private readonly control: ControlSurfaceContext,
    private readonly transport: Transport,
    private readonly playback: Playback,
    private readonly controlInputInterpreter: ControlInputInterpreter,
    private readonly domainIntentRouter: DomainIntentRouter,
  ) {}

  init(): void {}

  advancePlaybackTick(): void {
    const transportTick = this.transport.advance(DEFAULT_STEP_COUNT);
    const playbackAdvance = this.playback.processTransportTick(
      this.project,
      transportTick,
    );
    this.collectHostCommands(playbackAdvance.hostCommands);
  }

  dispatchControlInput(input: ControlInput): boolean {
    const intent = this.controlInputInterpreter.interpret(
      input,
      this.control.snapshot(this.project.selectedClipCell()),
    );
    if (!intent) return false;
    const transaction = this.domainIntentRouter.route(intent);
    if (transaction.applied) this.collectHostCommands(transaction.hostCommands);
    return transaction.applied;
  }

  snapshot(): CoreSnapshot {
    return buildCoreSnapshot({
      project: this.project,
      control: this.control,
      transport: this.transport,
      playback: this.playback,
      controlInputInterpreter: this.controlInputInterpreter,
    });
  }

  selectedSequenceLength(): number {
    return readSelectedSequenceLength({
      project: this.project,
      control: this.control,
      transport: this.transport,
      playback: this.playback,
      controlInputInterpreter: this.controlInputInterpreter,
    });
  }

  drainHostCommands(): HostCommand[] {
    return this.hostCommands.splice(0);
  }

  stopPlayback(): void {
    this.transport.stop();
    this.collectHostCommands(
      this.playback.stopAll(this.project, this.transport.clock()),
    );
  }

  private collectHostCommands(commands: readonly HostCommand[]): void {
    this.hostCommands.push(...commands);
  }
}
