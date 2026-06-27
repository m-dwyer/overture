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

/**
 * Marks transport timing as running.
 */
export function startTransport(transport: TransportState): void {
  transport.playing = true;
}

/**
 * Marks transport timing as stopped without changing the current playhead.
 */
export function stopTransport(transport: TransportState): void {
  transport.playing = false;
}

/**
 * Advances transport timing by one runtime tick when transport is running.
 *
 * Returns the new playhead step only on ticks that cross a sequencer step
 * boundary.
 */
export function advanceTransport(transport: TransportState, stepCount: number): number | null {
  if (!transport.playing) return null;
  transport.tick++;
  if (transport.tick % transport.ticksPerStep !== 0) return null;
  transport.playhead = (transport.playhead + 1) % stepCount;
  return transport.playhead;
}
