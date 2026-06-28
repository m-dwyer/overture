import type { HostCommand } from "../host-commands";
import type { ClipCellCoordinate, ClipId, OvertureProject } from "../project";
import { launchPlayingClip, stopAllPlayingClips, stopPlayingClipOnTrack } from "./internal/clips";
import { drainDueNoteOffs, injectPlaybackStep } from "./internal/notes";
import { createPlaybackState } from "./state";
import type { PlaybackState } from "./state";
import type { PlaybackClock, PlaybackTick } from "./types";

export interface PlaybackAdvance {
  injectedStep: number | null;
  hostCommands: HostCommand[];
}

export interface TrackPlaybackSnapshot {
  readonly trackIndex: number;
  readonly playingClipId: ClipId | null;
  readonly queuedClipId: ClipId | null;
}

export interface PlaybackSnapshot {
  readonly tracks: readonly TrackPlaybackSnapshot[];
}

/**
 * Owns playback-side clip focus and note-off scheduling, separate from durable
 * Project data and Transport timing. Reads the Project through its read
 * contracts to resolve playing clips and routes, but never mutates it.
 */
export class Playback {
  private readonly state: PlaybackState;

  constructor(state: PlaybackState) {
    this.state = state;
  }

  /**
   * Applies playback work for an already advanced runtime tick. Due note-offs
   * are emitted every tick; step note injection happens only when the transport
   * advances to a new sequencer step.
   */
  advance(project: OvertureProject, tick: Readonly<PlaybackTick>): PlaybackAdvance {
    const hostCommands = drainDueNoteOffs(this.state, tick.tick);
    if (tick.injectedStep !== null) {
      hostCommands.push(...injectPlaybackStep(project, this.state, tick.injectedStep, tick.tick));
    }
    return { injectedStep: tick.injectedStep, hostCommands };
  }

  /**
   * Starts playback and emits note commands for the current playhead. If no
   * track is playing a clip, playback starts from the selected clip cell when
   * that cell contains a clip.
   */
  start(project: OvertureProject, selectedClipCell: ClipCellCoordinate, clock: Readonly<PlaybackClock>): HostCommand[] {
    this.launchSelectedClipIfIdle(project, selectedClipCell);
    return injectPlaybackStep(project, this.state, clock.playhead, clock.tick);
  }

  /**
   * Clears all playing clips and emits any note-off commands needed to silence
   * the currently active playback state.
   */
  stop(project: OvertureProject, clock: Readonly<PlaybackClock>): HostCommand[] {
    return stopAllPlayingClips(project, this.state, clock);
  }

  /**
   * Launches the clip cell on its track. An occupied cell becomes the track's
   * playing clip; an empty cell stops and clears the track's current playing
   * clip, returning any note-off commands for the interrupted playback.
   */
  launchClipCell(
    project: OvertureProject,
    coordinate: ClipCellCoordinate,
    clock: Readonly<PlaybackClock>,
  ): HostCommand[] {
    const cell = project.clipCellAt(coordinate);
    const hostCommands = cell.clipId ? [] : stopPlayingClipOnTrack(project, this.state, clock, coordinate.trackIndex);
    launchPlayingClip(project, this.state, coordinate);
    return hostCommands;
  }

  /** Per-track playing/queued clip focus for read-only projections. */
  snapshot(): PlaybackSnapshot {
    return {
      tracks: this.state.tracks.map((track) => ({
        trackIndex: track.trackIndex,
        playingClipId: track.playingClipId,
        queuedClipId: track.queuedClipId,
      })),
    };
  }

  private launchSelectedClipIfIdle(project: OvertureProject, selectedClipCell: ClipCellCoordinate): void {
    if (this.state.tracks.some((track) => track.playingClipId)) return;
    const cell = project.clipCellAt(selectedClipCell);
    if (cell.clipId) launchPlayingClip(project, this.state, selectedClipCell);
  }
}

export function createPlayback(): Playback {
  return new Playback(createPlaybackState());
}
