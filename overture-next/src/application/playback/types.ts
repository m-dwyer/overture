/**
 * Read-only transport timing visible to playback.
 *
 * Playback can use the current clock position to emit notes and note-offs, but
 * transport remains the owner of playhead and tick mutation.
 */
export interface PlaybackClock {
  playhead: number;
  tick: number;
}

/**
 * Transport advancement result consumed by playback for one runtime tick.
 */
export interface PlaybackTick {
  injectedStep: number | null;
  tick: number;
}
