import type { HostCommand } from "../host-commands";
import type { ClipCellCoordinateInput, ClipId } from "../../domain/project";
import type { ProjectPlaybackReadModel } from "../../state/project";
import {
  applyQueuedTrackChanges,
  launchPlayingClip,
  queuePlayingClip,
  queueStopPlayingClipOnTrack,
  silenceAllPlayingClips,
  stopAllPlayingClips,
  stopPlayingClipOnTrack,
} from "./internal/clips";
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
  readonly queuedStop: boolean;
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

  private constructor() {
    this.state = createPlaybackState();
  }

  static create(): Playback {
    return new Playback();
  }

  /**
   * Applies playback work for an already advanced runtime tick. Due note-offs
   * are emitted every tick; step note injection happens only when the transport
   * advances to a new sequencer step.
   */
  advanceTick(
    project: ProjectPlaybackReadModel,
    tick: Readonly<PlaybackTick>,
  ): PlaybackAdvance {
    const hostCommands = drainDueNoteOffs(this.state, tick.tick);
    if (tick.injectedStep !== null) {
      hostCommands.push(
        ...applyQueuedTrackChanges(project, this.state, {
          playhead: tick.injectedStep,
          tick: tick.tick,
        }),
      );
      hostCommands.push(
        ...injectPlaybackStep(
          project,
          this.state,
          tick.injectedStep,
          tick.tick,
        ),
      );
    }
    return { injectedStep: tick.injectedStep, hostCommands };
  }

  /**
   * Emits note commands for the current playhead and schedules matching
   * note-offs. Transport owns the clock; playback owns the emitted note work.
   */
  injectStep(
    project: ProjectPlaybackReadModel,
    clock: Readonly<PlaybackClock>,
  ): HostCommand[] {
    return injectPlaybackStep(project, this.state, clock.playhead, clock.tick);
  }

  /**
   * Clears all playing clips and emits any note-off commands needed to silence
   * the currently active playback state.
   */
  stopAll(
    project: ProjectPlaybackReadModel,
    clock: Readonly<PlaybackClock>,
  ): HostCommand[] {
    return stopAllPlayingClips(project, this.state, clock);
  }

  /**
   * Emits note-off commands needed to stop current sound while preserving
   * Playback-owned playing Clip focus for transport resume.
   */
  silenceAll(
    project: ProjectPlaybackReadModel,
    clock: Readonly<PlaybackClock>,
  ): HostCommand[] {
    return silenceAllPlayingClips(project, this.state, clock);
  }

  /**
   * Stops one Track's playing clip and emits any note-off commands needed to
   * silence that Track.
   */
  stopTrack(
    project: ProjectPlaybackReadModel,
    trackIndex: number,
    clock: Readonly<PlaybackClock>,
  ): HostCommand[] {
    return stopPlayingClipOnTrack(project, this.state, clock, trackIndex);
  }

  /**
   * Launches the clip occupying a Clip Cell on that cell's Track. Empty Clip
   * Cells do not mutate playback; callers that treat empties as stop targets
   * should call `stopTrack`.
   */
  launchClipOnTrack(
    project: ProjectPlaybackReadModel,
    coordinate: ClipCellCoordinateInput,
  ): ClipId | null {
    return launchPlayingClip(project, this.state, coordinate);
  }

  /**
   * Queues the clip occupying a Clip Cell to start on that cell's Track at the
   * next launch boundary.
   */
  queueClipOnTrack(
    project: ProjectPlaybackReadModel,
    coordinate: ClipCellCoordinateInput,
  ): ClipId | null {
    return queuePlayingClip(project, this.state, coordinate);
  }

  /**
   * Queues one Track to stop at the next launch boundary.
   */
  queueStopTrack(trackIndex: number): void {
    queueStopPlayingClipOnTrack(this.state, trackIndex);
  }

  /** Per-track playing/queued clip focus for read-only projections. */
  snapshot(): PlaybackSnapshot {
    return {
      tracks: this.state.tracks.map((track) => ({
        trackIndex: track.trackIndex,
        playingClipId: track.playingClipId,
        queuedClipId: track.queuedClipId,
        queuedStop: track.queuedStop,
      })),
    };
  }
}

export function createPlayback(): Playback {
  return Playback.create();
}
