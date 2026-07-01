/**
 * Read-only transport clock position visible to application workflows.
 *
 * Transport owns mutation of these values; playback workflows may consume them
 * to schedule note work without taking transport mutation authority.
 */
export interface TransportClock {
  readonly playhead: number;
  readonly tick: number;
}

/**
 * Transport advancement result for one runtime tick.
 */
export interface TransportTick {
  readonly injectedStep: number | null;
  readonly tick: number;
}
