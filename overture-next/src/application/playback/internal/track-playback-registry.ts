import { TRACK_COUNT, type ClipId } from "../../../domain/project";

export interface TrackPlaybackSnapshot {
  readonly trackIndex: number;
  readonly playingClipId: ClipId | null;
  readonly queuedClipId: ClipId | null;
  readonly queuedStop: boolean;
}

export interface TrackPlaybackRegistrySnapshot {
  readonly tracks: readonly TrackPlaybackSnapshot[];
}

export type TrackToggleResult = { readonly kind: "launched" | "stopped" };

interface TrackPlaybackRecord {
  trackIndex: number;
  playingClipId: ClipId | null;
  queuedClipId: ClipId | null;
  queuedStop: boolean;
}

export class TrackPlaybackRegistry {
  private readonly tracks: TrackPlaybackRecord[];

  constructor(trackCount = TRACK_COUNT) {
    this.tracks = Array.from({ length: trackCount }, (_, trackIndex) => ({
      trackIndex,
      playingClipId: null,
      queuedClipId: null,
      queuedStop: false,
    }));
  }

  launch(trackIndex: number, clipId: ClipId): void {
    const track = this.requireTrack(trackIndex);
    track.playingClipId = clipId;
    track.queuedClipId = null;
    track.queuedStop = false;
  }

  toggleNow(trackIndex: number, clipId: ClipId): TrackToggleResult {
    const track = this.requireTrack(trackIndex);
    if (track.playingClipId === clipId) {
      this.clear(track);
      return { kind: "stopped" };
    }
    track.playingClipId = clipId;
    track.queuedClipId = null;
    track.queuedStop = false;
    return { kind: "launched" };
  }

  queueToggle(trackIndex: number, clipId: ClipId): void {
    const track = this.requireTrack(trackIndex);
    if (track.queuedStop && track.playingClipId === clipId) {
      track.queuedStop = false;
      return;
    }
    if (track.playingClipId === clipId || track.queuedClipId === clipId) {
      this.queueStop(trackIndex);
      return;
    }
    track.queuedClipId = clipId;
    track.queuedStop = false;
  }

  queueStop(trackIndex: number): void {
    const track = this.requireTrack(trackIndex);
    if (!track.playingClipId && !track.queuedClipId) return;
    track.queuedClipId = null;
    track.queuedStop = true;
  }

  stop(trackIndex: number): void {
    this.clear(this.requireTrack(trackIndex));
  }

  stopAll(): void {
    for (const track of this.tracks) this.clear(track);
  }

  clearQueuedChanges(): void {
    for (const track of this.tracks) {
      track.queuedClipId = null;
      track.queuedStop = false;
    }
  }

  applyQueuedChange(trackIndex: number): void {
    const track = this.requireTrack(trackIndex);
    if (track.queuedStop) {
      this.clear(track);
      return;
    }
    track.playingClipId = track.queuedClipId;
    track.queuedClipId = null;
    track.queuedStop = false;
  }

  tracksWithQueuedChanges(): readonly TrackPlaybackSnapshot[] {
    return this.tracks
      .filter((track) => track.queuedStop || track.queuedClipId)
      .map(snapshotTrack);
  }

  playingTracks(): readonly TrackPlaybackSnapshot[] {
    return this.tracks
      .filter((track) => track.playingClipId)
      .map(snapshotTrack);
  }

  playingClipIdForTrack(trackIndex: number): ClipId | null {
    return this.requireTrack(trackIndex).playingClipId;
  }

  snapshot(): TrackPlaybackRegistrySnapshot {
    return {
      tracks: this.tracks.map(snapshotTrack),
    };
  }

  private requireTrack(trackIndex: number): TrackPlaybackRecord {
    const track = this.tracks[trackIndex];
    if (!track) throw new RangeError("Track index out of range");
    return track;
  }

  private clear(track: TrackPlaybackRecord): void {
    track.playingClipId = null;
    track.queuedClipId = null;
    track.queuedStop = false;
  }
}

export function createTrackPlaybackRegistry(
  trackCount = TRACK_COUNT,
): TrackPlaybackRegistry {
  return new TrackPlaybackRegistry(trackCount);
}

function snapshotTrack(track: TrackPlaybackRecord): TrackPlaybackSnapshot {
  return {
    trackIndex: track.trackIndex,
    playingClipId: track.playingClipId,
    queuedClipId: track.queuedClipId,
    queuedStop: track.queuedStop,
  };
}
