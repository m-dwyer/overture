import { createInitialControlSurfaceContext } from "../state/control-surface-context";
import { createDefaultProject } from "../state/project";
import {
  buildCoreSnapshot,
  selectedSequenceLength as readSelectedSequenceLength,
} from "./core-read-model";
import { interpretControl } from "./controls/interpret-control";
import type { ControlInput } from "./controls/types";
import {
  createDomainIntentHandler,
  type DomainIntentHandler,
} from "./intents/domain-intent-handler";
import { createGlobalIntentHandler } from "./intents/global-intent-handler";
import { createSessionIntentHandler } from "./intents/session-intent-handler";
import { createTrackIntentHandler } from "./intents/track-intent-handler";
import { createTransportIntentHandler } from "./intents/transport-intent-handler";
import { createPlayback } from "./playback";
import { createTransport } from "./transport";
import {
  advanceTransportPlaybackTick,
  stopTransportPlayback,
} from "./transport-playback";
import type { CoreSnapshot, HostCommand, OvertureCore } from "./types";

export class OvertureCoreRuntime implements OvertureCore {
  private readonly project = createDefaultProject();
  private readonly control = createInitialControlSurfaceContext();
  private readonly transport = createTransport();
  private readonly playback = createPlayback();
  private readonly domainIntents: DomainIntentHandler;
  private readonly hostCommands: HostCommand[] = [];

  private constructor() {
    this.playback.seedDefaultScene(this.project);
    this.domainIntents = createDomainIntentHandler({
      global: createGlobalIntentHandler(this.control),
      session: createSessionIntentHandler({
        project: this.project,
        playback: this.playback,
        transport: this.transport,
      }),
      track: createTrackIntentHandler({
        control: this.control,
        project: this.project,
      }),
      transport: createTransportIntentHandler({
        project: this.project,
        playback: this.playback,
        transport: this.transport,
      }),
    });
  }

  static createDefault(): OvertureCoreRuntime {
    return new OvertureCoreRuntime();
  }

  init(): void {}

  advancePlaybackTick(): void {
    this.collectHostCommands(
      advanceTransportPlaybackTick({
        project: this.project,
        playback: this.playback,
        transport: this.transport,
      }),
    );
  }

  dispatchControlInput(input: ControlInput): boolean {
    const intent = interpretControl(
      input,
      this.control.snapshot(this.project.selectedClipCell()),
    );
    if (!intent) return false;
    const transaction = this.domainIntents.handle(intent);
    if (transaction.applied) this.collectHostCommands(transaction.hostCommands);
    return transaction.applied;
  }

  snapshot(): CoreSnapshot {
    return buildCoreSnapshot({
      project: this.project,
      control: this.control,
      transport: this.transport,
      playback: this.playback,
    });
  }

  selectedSequenceLength(): number {
    return readSelectedSequenceLength({
      project: this.project,
      control: this.control,
      transport: this.transport,
      playback: this.playback,
    });
  }

  drainHostCommands(): HostCommand[] {
    return this.hostCommands.splice(0);
  }

  stopPlayback(): void {
    this.collectHostCommands(
      stopTransportPlayback({
        project: this.project,
        playback: this.playback,
        transport: this.transport,
      }),
    );
  }

  private collectHostCommands(commands: readonly HostCommand[]): void {
    this.hostCommands.push(...commands);
  }
}
