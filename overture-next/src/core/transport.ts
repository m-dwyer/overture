export const DEFAULT_TICKS_PER_STEP = 12;

export interface TransportState {
  playing: boolean;
  tick: number;
  playhead: number;
  ticksPerStep: number;
}

export function createTransport(ticksPerStep = DEFAULT_TICKS_PER_STEP): TransportState {
  return {
    playing: false,
    tick: 0,
    playhead: 0,
    ticksPerStep,
  };
}

export function toggleTransport(transport: TransportState): boolean {
  transport.playing = !transport.playing;
  return transport.playing;
}

export function advanceTransport(transport: TransportState, stepCount: number): number | null {
  if (!transport.playing) return null;
  transport.tick++;
  if (transport.tick % transport.ticksPerStep !== 0) return null;
  transport.playhead = (transport.playhead + 1) % stepCount;
  return transport.playhead;
}
