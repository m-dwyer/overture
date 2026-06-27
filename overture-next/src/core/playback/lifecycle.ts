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

export function stopTransportPlayback(
  project: OvertureProject,
  playback: PlaybackState,
  transport: TransportState,
): HostCommand[] {
  transport.playing = false;
  return stopAllPlayingClips(project, playback, transport);
}

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
