import type { HostCommand } from "../host-commands";
import type { ClipCellCoordinateInput, ClipId } from "../../domain/project";
import { getSequenceStep } from "../../domain/sequence";
import type {
  ProjectCoreReadModel,
  ProjectPlaybackReadModel,
} from "../../state/project";
import {
  createNoteGateScheduler,
  type NoteGateScheduler,
} from "./internal/note-gate-scheduler";
import {
  createTrackLaunchScheduler,
  type TrackLaunchScheduler,
} from "./internal/track-launch-scheduler";
import type { TransportClock, TransportTick } from "../transport-timing";

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

export interface PlaybackTiming {
  readonly running: boolean;
  readonly clock: Readonly<TransportClock>;
}

/**
 * Owns playback-side clip focus and note-off scheduling, separate from durable
 * Project data and Transport timing. Reads the Project through its read
 * contracts to resolve playing clips and routes, but never mutates it.
 */
export class Playback {
  private readonly trackLaunches: TrackLaunchScheduler;
  private readonly noteGates: NoteGateScheduler;

  private constructor() {
    this.trackLaunches = createTrackLaunchScheduler();
    this.noteGates = createNoteGateScheduler();
  }

  static create(): Playback {
    return new Playback();
  }

  /**
   * Applies playback work for an already advanced runtime tick. Due note-offs
   * are emitted every tick; step note injection happens only when the transport
   * advances to a new sequencer step.
   */
  processTransportTick(
    project: ProjectPlaybackReadModel,
    tick: Readonly<TransportTick>,
  ): PlaybackAdvance {
    const hostCommands = this.noteGates.drainDue(tick.tick);
    if (tick.injectedStep !== null) {
      const clock = {
        playhead: tick.injectedStep,
        tick: tick.tick,
      };
      for (const track of this.trackLaunches.tracksWithQueuedChanges()) {
        hostCommands.push(
          ...this.silenceTrack(project, track.trackIndex, clock),
        );
        this.trackLaunches.applyQueuedChange(track.trackIndex);
      }
      hostCommands.push(
        ...this.startAt(project, {
          playhead: tick.injectedStep,
          tick: tick.tick,
        }),
      );
    }
    return { injectedStep: tick.injectedStep, hostCommands };
  }

  /**
   * Emits note commands for the current playhead and schedules matching
   * note-offs. Transport owns the clock; playback owns the emitted note work.
   */
  startAt(
    project: ProjectPlaybackReadModel,
    clock: Readonly<TransportClock>,
  ): HostCommand[] {
    const hostCommands: HostCommand[] = [];
    for (const trackPlayback of this.trackLaunches.playingTracks()) {
      if (!trackPlayback.playingClipId) continue;
      const clip = project.clipById(trackPlayback.playingClipId);
      if (!clip) continue;
      const sequenceStep = getSequenceStep(
        clip.sequence,
        clock.playhead % clip.sequence.length,
      );
      if (!sequenceStep?.active) continue;
      const route = project.trackRoute(trackPlayback.trackIndex);
      hostCommands.push({
        kind: "track-note-on",
        route,
        trackIndex: trackPlayback.trackIndex,
        note: sequenceStep.note,
        velocity: sequenceStep.velocity,
      });
      this.noteGates.schedule({
        dueTick: clock.tick + Math.max(1, sequenceStep.gateTicks),
        emittedTarget: route,
        trackIndex: trackPlayback.trackIndex,
        note: sequenceStep.note,
      });
    }
    return hostCommands;
  }

  /**
   * Clears all playing clips and emits any note-off commands needed to silence
   * the currently active playback state.
   */
  stopAll(
    project: ProjectPlaybackReadModel,
    clock: Readonly<TransportClock>,
  ): HostCommand[] {
    const hostCommands: HostCommand[] = [];
    for (const track of this.trackLaunches.snapshot().tracks) {
      hostCommands.push(...this.silenceTrack(project, track.trackIndex, clock));
    }
    this.trackLaunches.stopAll();
    return hostCommands;
  }

  /**
   * Emits note-off commands needed to stop current sound while preserving
   * Playback-owned playing Clip focus for transport resume.
   */
  pauseAt(
    project: ProjectPlaybackReadModel,
    clock: Readonly<TransportClock>,
  ): HostCommand[] {
    const hostCommands: HostCommand[] = [];
    for (const track of this.trackLaunches.snapshot().tracks) {
      hostCommands.push(...this.silenceTrack(project, track.trackIndex, clock));
    }
    this.trackLaunches.clearQueuedChanges();
    return hostCommands;
  }

  /**
   * Requests a Clip Cell activation toggle. Playback owns whether that request
   * launches immediately, stops immediately, or queues a launch-boundary change.
   */
  requestClipToggle(
    project: ProjectPlaybackReadModel,
    coordinate: ClipCellCoordinateInput,
    timing: Readonly<PlaybackTiming>,
  ): HostCommand[] {
    const cell = project.clipCellAt(coordinate);
    if (!cell.clipId)
      return this.requestTrackStop(project, coordinate.trackIndex, timing);
    if (timing.running) {
      this.trackLaunches.queueToggle(coordinate.trackIndex, cell.clipId);
      return [];
    }
    const result = this.trackLaunches.toggleNow(
      coordinate.trackIndex,
      cell.clipId,
    );
    if (result.kind === "stopped")
      return this.silenceTrack(project, coordinate.trackIndex, timing.clock);
    return [];
  }

  /**
   * Requests one Track to stop. Running transport queues the stop at the next
   * launch boundary; stopped transport clears immediately and silences the Track.
   */
  requestTrackStop(
    project: ProjectPlaybackReadModel,
    trackIndex: number,
    timing: Readonly<PlaybackTiming>,
  ): HostCommand[] {
    if (timing.running) {
      this.trackLaunches.queueStop(trackIndex);
      return [];
    }
    const hostCommands = this.silenceTrack(project, trackIndex, timing.clock);
    this.trackLaunches.stopNow(trackIndex);
    return hostCommands;
  }

  /**
   * Seeds Scene 1 Clips as the initial playback focus for a new runtime session.
   */
  seedDefaultScene(project: ProjectCoreReadModel): void {
    for (const cell of project.clipCellSnapshots()) {
      if (cell.sceneIndex !== 0 || !cell.clipId) continue;
      this.trackLaunches.launchNow(cell.trackIndex, cell.clipId);
    }
  }

  /** Per-track playing/queued clip focus for read-only projections. */
  snapshot(): PlaybackSnapshot {
    return this.trackLaunches.snapshot();
  }

  private silenceTrack(
    project: ProjectPlaybackReadModel,
    trackIndex: number,
    clock: Readonly<TransportClock>,
  ): HostCommand[] {
    const pending = this.noteGates.drainTrack(trackIndex);
    if (pending.length > 0) return pending;
    const playingClipId = this.trackLaunches.playingClipIdForTrack(trackIndex);
    if (!playingClipId) return [];
    const clip = project.clipById(playingClipId);
    if (!clip) return [];
    const step = getSequenceStep(
      clip.sequence,
      clock.playhead % clip.sequence.length,
    );
    if (!step?.active) return [];
    return [
      {
        kind: "track-note-off",
        route: project.trackRoute(trackIndex),
        trackIndex,
        note: step.note,
      },
    ];
  }
}

export function createPlayback(): Playback {
  return Playback.create();
}
