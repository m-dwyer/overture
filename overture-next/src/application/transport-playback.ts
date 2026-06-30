import { DEFAULT_STEP_COUNT } from "../domain/sequence";
import type { ProjectPlaybackReadModel } from "../state/project";
import type { HostCommand } from "./host-commands";
import type { PlaybackAdvance } from "./playback";
import type { TransportClock, TransportTick } from "./transport-timing";

interface TransportDrivenPlayback {
  processTransportTick(
    project: ProjectPlaybackReadModel,
    tick: Readonly<TransportTick>,
  ): PlaybackAdvance;
  stopAll(
    project: ProjectPlaybackReadModel,
    clock: Readonly<TransportClock>,
  ): HostCommand[];
}

interface TransportPlaybackControl {
  advance(stepCount: number): TransportTick;
  stop(): void;
  clock(): TransportClock;
}

export interface TransportPlaybackContext {
  readonly project: ProjectPlaybackReadModel;
  readonly playback: TransportDrivenPlayback;
  readonly transport: TransportPlaybackControl;
}

export function advanceTransportPlaybackTick({
  project,
  playback,
  transport,
}: TransportPlaybackContext): HostCommand[] {
  const transportTick = transport.advance(DEFAULT_STEP_COUNT);
  return playback.processTransportTick(project, transportTick).hostCommands;
}

export function stopTransportPlayback({
  project,
  playback,
  transport,
}: TransportPlaybackContext): HostCommand[] {
  transport.stop();
  return playback.stopAll(project, transport.clock());
}
