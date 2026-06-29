import type { Sequence, SequenceStep } from "../domain/sequence";
import { sequenceWithToggledStep } from "../domain/sequence";
import { getTrack } from "../domain/track";
import type { Track, TrackRoute } from "../domain/track";
import {
  createDefaultProjectData,
  findClipCell,
  type ClipCell,
  type ClipCellCoordinateInput,
  type ClipId,
  type OvertureClip,
  type OvertureProjectData,
  type SceneIndex,
  type TrackIndex,
  trackIndex,
} from "../domain/project";

export type {
  ClipCellCoordinate,
  ClipCellCoordinateInput,
  ClipId,
  OvertureClip,
  SceneIndex,
  TrackIndex,
} from "../domain/project";

export interface ClipCellSnapshot {
  readonly trackIndex: TrackIndex;
  readonly sceneIndex: SceneIndex;
  readonly clipId: ClipId | null;
}

/**
 * The OvertureProject state owner: durable owner of Tracks, Overture Scenes,
 * Clip Cells, and Overture Clips. It keeps occupancy and identity state private
 * and exposes read contracts; clip-lifecycle write verbs are added as features
 * require them. A Clip Cell is the single source of truth for clip location.
 */
export class OvertureProject {
  private readonly data: OvertureProjectData;

  constructor(data: OvertureProjectData) {
    this.data = data;
  }

  /** Read-only occupancy at a coordinate. Throws when the coordinate is off-grid. */
  clipCellAt(coordinate: ClipCellCoordinateInput): ClipCellSnapshot {
    return snapshotCell(this.requireCell(coordinate));
  }

  /** The Overture Clip occupying a coordinate, or null for an Empty Clip Cell. */
  clipFor(coordinate: ClipCellCoordinateInput): OvertureClip | null {
    const cell = this.requireCell(coordinate);
    if (!cell.clipId) return null;
    return this.data.clips[cell.clipId] ?? null;
  }

  /** The Sequence owned by the clip at a coordinate, or null for an Empty Clip Cell. */
  sequenceFor(coordinate: ClipCellCoordinateInput): Sequence | null {
    return this.clipFor(coordinate)?.sequence ?? null;
  }

  /** Resolves an Overture Clip by its Clip ID, or null when it no longer exists. */
  clipById(clipId: ClipId): OvertureClip | null {
    return this.data.clips[clipId] ?? null;
  }

  /** Copied Clip Cell occupancy for the whole grid, for read-only projections. */
  clipCellSnapshots(): ClipCellSnapshot[] {
    return this.data.clipCells.map(snapshotCell);
  }

  /** The Track at an index. Throws when the index is out of range. */
  track(trackIndexValue: number): Track {
    return getTrack(this.data.tracks, trackIndex(trackIndexValue));
  }

  /** A copy of the Track Route, so callers cannot mutate Project-owned route state. */
  trackRoute(trackIndexValue: number): TrackRoute {
    return { ...getTrack(this.data.tracks, trackIndex(trackIndexValue)).route };
  }

  toggleSequenceStepAt(coordinate: ClipCellCoordinateInput, stepIndex: number): SequenceStep | null {
    const clip = this.clipFor(coordinate);
    if (!clip) return null;
    const result = sequenceWithToggledStep(clip.sequence, stepIndex);
    if (!result) return null;
    clip.sequence = result.sequence;
    return result.step;
  }

  private requireCell(coordinate: ClipCellCoordinateInput): ClipCell {
    const cell = findClipCell(this.data.clipCells, coordinate);
    if (!cell) throw new Error("Missing clip cell " + coordinate.trackIndex + ":" + coordinate.sceneIndex);
    return cell;
  }
}

export function createDefaultProject(): OvertureProject {
  return new OvertureProject(createDefaultProjectData());
}

function snapshotCell(cell: ClipCell): ClipCellSnapshot {
  return {
    trackIndex: cell.trackIndex,
    sceneIndex: cell.sceneIndex,
    clipId: cell.clipId,
  };
}
