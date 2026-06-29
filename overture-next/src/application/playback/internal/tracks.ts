import type { PlaybackState, TrackPlaybackState } from "../state";

export function getTrackPlayback(
  playback: PlaybackState,
  trackIndex: number,
): TrackPlaybackState {
  const track = playback.tracks[trackIndex];
  if (!track) throw new Error("Missing playback track " + trackIndex);
  return track;
}
