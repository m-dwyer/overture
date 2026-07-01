import type { ProjectPlaybackReadModel } from "../../state/project";
import type { Playback } from "../playback";
import type { TransportClock } from "../transport-timing";
import { intentApplied } from "./transaction";
import type { DomainIntentTransaction, TransportIntent } from "./types";

interface TransportPlaybackControl {
  isPlaying(): boolean;
  start(): void;
  stop(): void;
  clock(): TransportClock;
}

export class TransportIntentHandler {
  constructor(
    private readonly project: ProjectPlaybackReadModel,
    private readonly playback: Pick<Playback, "startAt" | "pauseAt">,
    private readonly transport: TransportPlaybackControl,
  ) {}

  handle(_intent: TransportIntent): DomainIntentTransaction {
    return this.toggleTransportPlayback();
  }

  private toggleTransportPlayback(): DomainIntentTransaction {
    if (this.transport.isPlaying()) {
      this.transport.stop();
      return intentApplied(
        this.playback.pauseAt(this.project, this.transport.clock()),
      );
    }

    this.transport.start();
    return intentApplied(
      this.playback.startAt(this.project, this.transport.clock()),
    );
  }
}
