import { assertNever } from "../../shared/assert-never";
import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import type { Playback } from "../playback";
import type { Transport } from "../transport";
import { GlobalIntentHandler } from "./global-intent-handler";
import { SessionIntentHandler } from "./session-intent-handler";
import { TrackIntentHandler } from "./track-intent-handler";
import { TransportIntentHandler } from "./transport-intent-handler";
import type { DomainIntent, DomainIntentTransaction } from "./types";

export interface DomainIntentRouterDependencies {
  readonly control: ControlSurfaceContext;
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: Transport;
}

export class DomainIntentRouter {
  private readonly global: GlobalIntentHandler;
  private readonly session: SessionIntentHandler;
  private readonly track: TrackIntentHandler;
  private readonly transport: TransportIntentHandler;

  constructor({
    control,
    project,
    playback,
    transport,
  }: DomainIntentRouterDependencies) {
    this.global = new GlobalIntentHandler(control);
    this.session = new SessionIntentHandler(project, playback, transport);
    this.track = new TrackIntentHandler(control, project);
    this.transport = new TransportIntentHandler(project, playback, transport);
  }

  route(intent: DomainIntent): DomainIntentTransaction {
    switch (intent.scope) {
      case "global":
        return this.global.handle(intent);
      case "session":
        return this.session.handle(intent);
      case "track":
        return this.track.handle(intent);
      case "transport":
        return this.transport.handle(intent);
      default:
        return assertNever(intent);
    }
  }
}
