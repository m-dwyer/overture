import type { HostCommand } from "../../host-commands";
import type { ClipCellCoordinateInput, ClipId } from "../../../domain/project";
import { getSequenceStep } from "../../../domain/sequence";
import type { ProjectPlaybackReadModel } from "../../../state/project";
import type { PlaybackState, TrackPlaybackState } from "../state";
import type { PlaybackClock } from "../types";
import { drainPendingNoteOffsForTrack } from "./notes";
import { getPlayingClip } from "./playing-clips";
import { getTrackPlayback } from "./tracks";

export function launchPlayingClip(
  project: ProjectPlaybackReadModel,
  playback: PlaybackState,
  coordinate: ClipCellCoordinateInput,
): ClipId | null {
  const cell = project.clipCellAt(coordinate);
  if (!cell.clipId) return null;
  const track = getTrackPlayback(playback, coordinate.trackIndex);
  track.playingClipId = cell.clipId;
  track.queuedClipId = null;
  return track.playingClipId;
}

export function clearPlayingClip(trackPlayback: TrackPlaybackState): void {
  trackPlayback.playingClipId = null;
  trackPlayback.queuedClipId = null;
}

export function stopPlayingClipOnTrack(
  project: ProjectPlaybackReadModel,
  playback: PlaybackState,
  clock: Readonly<PlaybackClock>,
  trackIndex: number,
): HostCommand[] {
  const trackPlayback = getTrackPlayback(playback, trackIndex);
  const hostCommands = stopTrackPlayback(
    project,
    playback,
    trackPlayback,
    clock,
  );
  clearPlayingClip(trackPlayback);
  return hostCommands;
}

export function stopAllPlayingClips(
  project: ProjectPlaybackReadModel,
  playback: PlaybackState,
  clock: Readonly<PlaybackClock>,
): HostCommand[] {
  const hostCommands: HostCommand[] = [];
  for (const trackPlayback of playback.tracks) {
    hostCommands.push(
      ...stopTrackPlayback(project, playback, trackPlayback, clock),
    );
    clearPlayingClip(trackPlayback);
  }
  return hostCommands;
}

function stopTrackPlayback(
  project: ProjectPlaybackReadModel,
  playback: PlaybackState,
  trackPlayback: TrackPlaybackState,
  clock: Readonly<PlaybackClock>,
): HostCommand[] {
  const pending = drainPendingNoteOffsForTrack(
    playback,
    trackPlayback.trackIndex,
  );
  if (pending.length > 0) return pending;
  const clip = getPlayingClip(project, trackPlayback);
  if (!clip) return [];
  const step = getSequenceStep(
    clip.sequence,
    clock.playhead % clip.sequence.length,
  );
  if (!step?.active) return [];
  return [
    {
      kind: "track-note-off",
      route: project.trackRoute(trackPlayback.trackIndex),
      trackIndex: trackPlayback.trackIndex,
      note: step.note,
    },
  ];
}
