import type { ClipId, OvertureClip, OvertureProject, ClipCellCoordinate } from "./project";
import { getClipCell } from "./project";
import { TRACK_COUNT } from "./track";

export interface TrackPlaybackState {
  trackIndex: number;
  playingClipId: ClipId | null;
  queuedClipId: ClipId | null;
}

export interface PlaybackState {
  tracks: TrackPlaybackState[];
}

export function createPlaybackState(trackCount = TRACK_COUNT): PlaybackState {
  return {
    tracks: Array.from({ length: trackCount }, (_, trackIndex) => ({
      trackIndex,
      playingClipId: null,
      queuedClipId: null,
    })),
  };
}

export function getTrackPlayback(playback: PlaybackState, trackIndex: number): TrackPlaybackState {
  const track = playback.tracks[trackIndex];
  if (!track) throw new Error("Missing playback track " + trackIndex);
  return track;
}

export function launchClipCell(
  project: OvertureProject,
  playback: PlaybackState,
  coordinate: ClipCellCoordinate,
): ClipId | null {
  const cell = getClipCell(project, coordinate);
  const track = getTrackPlayback(playback, coordinate.trackIndex);
  track.playingClipId = cell.clipId;
  track.queuedClipId = null;
  return track.playingClipId;
}

export function getPlayingClip(project: OvertureProject, track: TrackPlaybackState): OvertureClip | null {
  if (!track.playingClipId) return null;
  return project.clips[track.playingClipId] ?? null;
}
