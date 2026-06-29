export const DEFAULT_TICKS_PER_STEP = 12;

export interface TransportStateSnapshot {
  readonly playing: boolean;
  readonly tick: number;
  readonly playhead: number;
  readonly ticksPerStep: number;
}

export interface TransportClock {
  readonly playhead: number;
  readonly tick: number;
}

export interface TransportTick {
  readonly injectedStep: number | null;
  readonly tick: number;
}

/**
 * Owns transport timing and exposes snapshots/read contracts for other core modules.
 */
export class TransportState {
  private playingValue: boolean;
  private tickValue: number;
  private playheadValue: number;
  private ticksPerStepValue: number;

  constructor(ticksPerStep = DEFAULT_TICKS_PER_STEP) {
    this.playingValue = false;
    this.tickValue = 0;
    this.playheadValue = 0;
    this.ticksPerStepValue = ticksPerStep;
  }

  /**
   * Returns the complete immutable transport timing snapshot for UI derivation.
   */
  snapshot(): TransportStateSnapshot {
    return {
      playing: this.playingValue,
      tick: this.tickValue,
      playhead: this.playheadValue,
      ticksPerStep: this.ticksPerStepValue,
    };
  }

  /**
   * Returns the narrow clock contract needed by playback injection and note-offs.
   */
  clock(): TransportClock {
    return {
      playhead: this.playheadValue,
      tick: this.tickValue,
    };
  }

  isPlaying(): boolean {
    return this.playingValue;
  }

  /**
   * Marks transport timing as running.
   */
  start(): void {
    this.playingValue = true;
  }

  /**
   * Marks transport timing as stopped without changing the current playhead.
   */
  stop(): void {
    this.playingValue = false;
  }

  /**
   * Moves the playhead without changing running state or absolute tick count.
   */
  seekToStep(playhead: number): void {
    this.playheadValue = playhead;
  }

  /**
   * Advances transport timing by one runtime tick when transport is running.
   *
   * Returns the new playhead step only on ticks that cross a sequencer step
   * boundary.
   */
  advance(stepCount: number): TransportTick {
    if (!this.playingValue) return { injectedStep: null, tick: this.tickValue };
    this.tickValue++;
    if (this.tickValue % this.ticksPerStepValue !== 0)
      return { injectedStep: null, tick: this.tickValue };
    this.playheadValue = (this.playheadValue + 1) % stepCount;
    return { injectedStep: this.playheadValue, tick: this.tickValue };
  }
}

export function createTransport(
  ticksPerStep = DEFAULT_TICKS_PER_STEP,
): TransportState {
  return new TransportState(ticksPerStep);
}
