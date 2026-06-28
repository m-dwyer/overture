import type { HostCommand } from "../host-commands";
import type { ClipCellCoordinate, OvertureProject } from "../project";
import { launchPlayingClip, stopAllPlayingClips, stopPlayingClipOnTrack } from "./internal/clips";
import { drainDueNoteOffs, injectPlaybackStep } from "./internal/notes";
import type { PlaybackState } from "./state";
import type { PlaybackClock, PlaybackTick } from "./types";

export interface PlaybackAdvance {
  injectedStep: number | null;
  hostCommands: HostCommand[];
}

/**
 * Starts playback-side clip state and emits note commands for the current playhead.
 *
 * If no track is currently playing a clip, playback starts from the selected
 * clip cell when that cell contains a clip.
 */
export function startPlayback(
  project: OvertureProject,
  playback: PlaybackState,
  selectedClipCell: ClipCellCoordinate,
  clock: Readonly<PlaybackClock>,
): HostCommand[] {
  launchSelectedClipIfPlaybackIdle(project, playback, selectedClipCell);
  return injectPlaybackStep(project, playback, clock.playhead, clock.tick);
}

/**
 * Stops playback-side clip state, clears all playing clips, and emits any note-off
 * commands needed to silence the currently active playback state.
 */
export function stopPlayback(
  project: OvertureProject,
  playback: PlaybackState,
  clock: Readonly<PlaybackClock>,
): HostCommand[] {
  return stopAllPlayingClips(project, playback, clock);
}

/**
 * Applies playback work for an already advanced runtime tick.
 *
 * Due note-offs are emitted every tick. Step note injection happens only when
 * the transport advances to a new sequencer step.
 */
export function advancePlayback(
  project: OvertureProject,
  playback: PlaybackState,
  tick: Readonly<PlaybackTick>,
): PlaybackAdvance {
  const hostCommands = drainDueNoteOffs(playback, tick.tick);
  if (tick.injectedStep !== null) {
    hostCommands.push(...injectPlaybackStep(project, playback, tick.injectedStep, tick.tick));
  }
  return { injectedStep: tick.injectedStep, hostCommands };
}

/**
 * Launches the clip cell on its track.
 *
 * Launching an occupied cell makes that clip the track's playing clip. Launching
 * an empty cell stops and clears the track's current playing clip, returning any
 * note-off commands required for the interrupted playback state.
 */
export function launchClipCellPlayback(
  project: OvertureProject,
  playback: PlaybackState,
  coordinate: ClipCellCoordinate,
  clock: Readonly<PlaybackClock>,
): HostCommand[] {
  const cell = project.clipCellAt(coordinate);
  const hostCommands = cell.clipId ? [] : stopPlayingClipOnTrack(project, playback, clock, coordinate.trackIndex);
  launchPlayingClip(project, playback, coordinate);
  return hostCommands;
}

function launchSelectedClipIfPlaybackIdle(
  project: OvertureProject,
  playback: PlaybackState,
  selectedClipCell: ClipCellCoordinate,
): void {
  if (playback.tracks.some((track) => track.playingClipId)) return;
  const cell = project.clipCellAt(selectedClipCell);
  if (cell.clipId) launchPlayingClip(project, playback, selectedClipCell);
}
