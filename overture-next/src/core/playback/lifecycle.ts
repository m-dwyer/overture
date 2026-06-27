import type { HostCommand } from "../host-commands";
import type { ClipCellCoordinate, OvertureProject } from "../project";
import { getClipCell } from "../project";
import { DEFAULT_STEP_COUNT } from "../sequence";
import { advanceTransport, type TransportState } from "../transport";
import { launchPlayingClip, stopAllPlayingClips, stopPlayingClipOnTrack } from "./internal/clips";
import { drainDueNoteOffs, injectPlaybackStep } from "./internal/notes";
import type { PlaybackState } from "./state";

export interface PlaybackAdvance {
  injectedStep: number | null;
  hostCommands: HostCommand[];
}

/**
 * Starts transport playback and emits note commands for the current playhead.
 *
 * If no track is currently playing a clip, playback starts from the selected
 * clip cell when that cell contains a clip.
 */
export function startTransportPlayback(
  project: OvertureProject,
  playback: PlaybackState,
  transport: TransportState,
  selectedClipCell: ClipCellCoordinate,
): HostCommand[] {
  transport.playing = true;
  launchSelectedClipIfPlaybackIdle(project, playback, selectedClipCell);
  return injectPlaybackStep(project, playback, transport.playhead, transport.tick);
}

/**
 * Stops transport playback, clears all playing clips, and emits any note-off
 * commands needed to silence the currently active playback state.
 */
export function stopTransportPlayback(
  project: OvertureProject,
  playback: PlaybackState,
  transport: TransportState,
): HostCommand[] {
  transport.playing = false;
  return stopAllPlayingClips(project, playback, transport);
}

/**
 * Advances transport timing by one runtime tick.
 *
 * Due note-offs are emitted every tick. Step note injection happens only when
 * the transport advances to a new sequencer step.
 */
export function advancePlayback(
  project: OvertureProject,
  playback: PlaybackState,
  transport: TransportState,
): PlaybackAdvance {
  const nextStep = advanceTransport(transport, DEFAULT_STEP_COUNT);
  const hostCommands = drainDueNoteOffs(playback, transport.tick);
  if (nextStep !== null) {
    hostCommands.push(...injectPlaybackStep(project, playback, nextStep, transport.tick));
  }
  return { injectedStep: nextStep, hostCommands };
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
  transport: TransportState,
  coordinate: ClipCellCoordinate,
): HostCommand[] {
  const cell = getClipCell(project, coordinate);
  const hostCommands = cell.clipId ? [] : stopPlayingClipOnTrack(project, playback, transport, coordinate.trackIndex);
  launchPlayingClip(project, playback, coordinate);
  return hostCommands;
}

function launchSelectedClipIfPlaybackIdle(
  project: OvertureProject,
  playback: PlaybackState,
  selectedClipCell: ClipCellCoordinate,
): void {
  if (playback.tracks.some((track) => track.playingClipId)) return;
  const cell = getClipCell(project, selectedClipCell);
  if (cell.clipId) launchPlayingClip(project, playback, selectedClipCell);
}
