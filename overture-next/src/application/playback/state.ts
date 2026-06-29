import type { HostCommand } from "../host-commands";
import { TRACK_COUNT, type ClipId } from "../../domain/project";

/**
 * Per-track playback focus.
 *
 * `playingClipId` is the clip currently driving note injection for the track.
 * `queuedClipId` is the clip scheduled to replace it at the next launch
 * boundary. `queuedStop` schedules the Track to stop at that boundary.
 */
export interface TrackPlaybackState {
  trackIndex: number;
  playingClipId: ClipId | null;
  queuedClipId: ClipId | null;
  queuedStop: boolean;
}

/**
 * A note-off scheduled by playback after a note-on command has been emitted.
 */
export interface ScheduledNoteOff {
  dueTick: number;
  note: number;
  route: HostCommand["route"];
  trackIndex: number;
}

/**
 * Playback-owned state that is separate from project data and transport timing.
 */
export interface PlaybackState {
  pendingNoteOffs: ScheduledNoteOff[];
  tracks: TrackPlaybackState[];
}

/**
 * Creates empty playback state for the project track count.
 */
export function createPlaybackState(trackCount = TRACK_COUNT): PlaybackState {
  return {
    pendingNoteOffs: [],
    tracks: Array.from({ length: trackCount }, (_, trackIndex) => ({
      trackIndex,
      playingClipId: null,
      queuedClipId: null,
      queuedStop: false,
    })),
  };
}
