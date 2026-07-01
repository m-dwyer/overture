import type { ProjectPlaybackReadModel } from "../../state/project";
import type { Playback } from "../playback";
import type { TransportClock } from "../transport-timing";
import { intentApplied } from "./transaction";
import type { DomainIntentTransaction, TransportIntent } from "./types";

export interface TransportIntentHandler {
  handle(intent: TransportIntent): DomainIntentTransaction;
}

export interface TransportIntentHandlerDependencies {
  readonly project: ProjectPlaybackReadModel;
  readonly playback: Pick<Playback, "startAt" | "pauseAt">;
  readonly transport: TransportPlaybackControl;
}

interface TransportPlaybackControl {
  isPlaying(): boolean;
  start(): void;
  stop(): void;
  clock(): TransportClock;
}

export function createTransportIntentHandler({
  project,
  playback,
  transport,
}: TransportIntentHandlerDependencies): TransportIntentHandler {
  return {
    handle() {
      return toggleTransportPlayback();
    },
  };

  function toggleTransportPlayback(): DomainIntentTransaction {
    if (transport.isPlaying()) {
      transport.stop();
      return intentApplied(playback.pauseAt(project, transport.clock()));
    }

    transport.start();
    return intentApplied(playback.startAt(project, transport.clock()));
  }
}
