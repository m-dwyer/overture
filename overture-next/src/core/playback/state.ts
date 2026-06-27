import type { HostCommand } from "../host-commands";
import type { ClipId } from "../project";
import { TRACK_COUNT } from "../track";

export interface TrackPlaybackState {
  trackIndex: number;
  playingClipId: ClipId | null;
  queuedClipId: ClipId | null;
}

export interface ScheduledNoteOff {
  dueTick: number;
  note: number;
  route: HostCommand["route"];
  trackIndex: number;
}

export interface PlaybackState {
  pendingNoteOffs: ScheduledNoteOff[];
  tracks: TrackPlaybackState[];
}

export function createPlaybackState(trackCount = TRACK_COUNT): PlaybackState {
  return {
    pendingNoteOffs: [],
    tracks: Array.from({ length: trackCount }, (_, trackIndex) => ({
      trackIndex,
      playingClipId: null,
      queuedClipId: null,
    })),
  };
}
