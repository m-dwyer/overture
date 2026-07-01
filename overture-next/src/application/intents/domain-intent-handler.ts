import { assertNever } from "../../shared/assert-never";
import type { GlobalIntentHandler } from "./global-intent-handler";
import type { SessionIntentHandler } from "./session-intent-handler";
import type { TrackIntentHandler } from "./track-intent-handler";
import type { TransportIntentHandler } from "./transport-intent-handler";
import type { DomainIntent, DomainIntentTransaction } from "./types";

export interface DomainIntentHandler {
  handle(intent: DomainIntent): DomainIntentTransaction;
}

export interface DomainIntentHandlers {
  readonly global: GlobalIntentHandler;
  readonly session: SessionIntentHandler;
  readonly track: TrackIntentHandler;
  readonly transport: TransportIntentHandler;
}

export function createDomainIntentHandler(
  handlers: DomainIntentHandlers,
): DomainIntentHandler {
  return {
    handle(intent) {
      switch (intent.scope) {
        case "global":
          return handlers.global.handle(intent);
        case "session":
          return handlers.session.handle(intent);
        case "track":
          return handlers.track.handle(intent);
        case "transport":
          return handlers.transport.handle(intent);
        default:
          return assertNever(intent);
      }
    },
  };
}
