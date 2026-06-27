import type { HostCommand } from "./host-commands";
import type { ClipId, OvertureClip, OvertureProject, ClipCellCoordinate } from "./project";
import { getClipCell } from "./project";
import { getSequenceStep } from "./sequence";
import { TRACK_COUNT, getTrack } from "./track";
import type { TransportState } from "./transport";

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

export function stopPlayingClip(
  project: OvertureProject,
  playback: PlaybackState,
  transport: TransportState,
  trackIndex: number,
): HostCommand[] {
  const trackPlayback = getTrackPlayback(playback, trackIndex);
  const hostCommands = stopTrackPlayback(project, trackPlayback, transport);
  trackPlayback.playingClipId = null;
  trackPlayback.queuedClipId = null;
  return hostCommands;
}

export function getPlayingClip(project: OvertureProject, track: TrackPlaybackState): OvertureClip | null {
  if (!track.playingClipId) return null;
  return project.clips[track.playingClipId] ?? null;
}

export function injectPlaybackStep(project: OvertureProject, playback: PlaybackState, step: number): HostCommand[] {
  const hostCommands: HostCommand[] = [];
  for (const trackPlayback of playback.tracks) {
    const clip = getPlayingClip(project, trackPlayback);
    if (!clip) continue;
    const sequenceStep = getSequenceStep(clip.sequence, step % clip.sequence.length);
    if (!sequenceStep?.active) continue;
    const route = getTrack(project.tracks, trackPlayback.trackIndex).route;
    hostCommands.push(
      {
        kind: "track-note-on",
        route,
        trackIndex: trackPlayback.trackIndex,
        note: sequenceStep.note,
        velocity: sequenceStep.velocity,
      },
      { kind: "track-note-off", route, trackIndex: trackPlayback.trackIndex, note: sequenceStep.note },
    );
  }
  return hostCommands;
}

export function stopPlayingClips(
  project: OvertureProject,
  playback: PlaybackState,
  transport: TransportState,
): HostCommand[] {
  const hostCommands: HostCommand[] = [];
  for (const trackPlayback of playback.tracks) {
    hostCommands.push(...stopTrackPlayback(project, trackPlayback, transport));
  }
  return hostCommands;
}

function stopTrackPlayback(
  project: OvertureProject,
  trackPlayback: TrackPlaybackState,
  transport: TransportState,
): HostCommand[] {
  const clip = getPlayingClip(project, trackPlayback);
  if (!clip) return [];
  const step = getSequenceStep(clip.sequence, transport.playhead % clip.sequence.length);
  if (!step?.active) return [];
  return [
    {
      kind: "track-note-off",
      route: getTrack(project.tracks, trackPlayback.trackIndex).route,
      trackIndex: trackPlayback.trackIndex,
      note: step.note,
    },
  ];
}
