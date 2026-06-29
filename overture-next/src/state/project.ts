import type { Sequence, SequenceStep } from "../domain/sequence";
import { sequenceWithToggledStep } from "../domain/sequence";
import { getTrack } from "../domain/track";
import type { TrackRoute } from "../domain/track";
import {
  createDefaultProjectData,
  findClipCell,
  type ClipCell,
  type ClipCellCoordinateInput,
  type ClipId,
  type OvertureProjectData,
  type SceneIndex,
  type TrackIndex,
  trackIndex,
} from "../domain/project";

export type {
  ClipCellCoordinate,
  ClipCellCoordinateInput,
  ClipId,
  SceneIndex,
  TrackIndex,
} from "../domain/project";

export interface ClipCellSnapshot {
  readonly trackIndex: TrackIndex;
  readonly sceneIndex: SceneIndex;
  readonly clipId: ClipId | null;
}

export interface SequenceStepSnapshot {
  readonly index: SequenceStep["index"];
  readonly active: boolean;
  readonly note: number;
  readonly velocity: number;
  readonly gateTicks: number;
}

export interface SequenceSnapshot {
  readonly length: number;
  readonly steps: readonly SequenceStepSnapshot[];
}

export interface OvertureClipSnapshot {
  readonly id: ClipId;
  readonly sequence: SequenceSnapshot;
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
  clipFor(coordinate: ClipCellCoordinateInput): OvertureClipSnapshot | null {
    const cell = this.requireCell(coordinate);
    if (!cell.clipId) return null;
    return snapshotClip(this.data.clips[cell.clipId]);
  }

  /** The Sequence owned by the clip at a coordinate, or null for an Empty Clip Cell. */
  sequenceFor(coordinate: ClipCellCoordinateInput): SequenceSnapshot | null {
    return this.clipFor(coordinate)?.sequence ?? null;
  }

  /** Resolves an Overture Clip by its Clip ID, or null when it no longer exists. */
  clipById(clipId: ClipId): OvertureClipSnapshot | null {
    return snapshotClip(this.data.clips[clipId]);
  }

  /** Copied Clip Cell occupancy for the whole grid, for read-only projections. */
  clipCellSnapshots(): readonly ClipCellSnapshot[] {
    return this.data.clipCells.map(snapshotCell);
  }

  /** A copy of the Track Route, so callers cannot mutate Project-owned route state. */
  trackRoute(trackIndexValue: number): TrackRoute {
    return { ...getTrack(this.data.tracks, trackIndex(trackIndexValue)).route };
  }

  toggleSequenceStepAt(coordinate: ClipCellCoordinateInput, stepIndex: number): SequenceStepSnapshot | null {
    const cell = this.requireCell(coordinate);
    if (!cell.clipId) return null;
    const clip = this.data.clips[cell.clipId];
    if (!clip) return null;
    const result = sequenceWithToggledStep(clip.sequence, stepIndex);
    if (!result) return null;
    clip.sequence = result.sequence;
    return snapshotStep(result.step);
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

function snapshotClip(clip: OvertureProjectData["clips"][ClipId] | undefined): OvertureClipSnapshot | null {
  if (!clip) return null;
  return {
    id: clip.id,
    sequence: snapshotSequence(clip.sequence),
  };
}

function snapshotSequence(sequence: Sequence): SequenceSnapshot {
  return {
    length: sequence.length,
    steps: sequence.steps.map(snapshotStep),
  };
}

function snapshotStep(step: SequenceStep): SequenceStepSnapshot {
  return {
    index: step.index,
    active: step.active,
    note: step.note,
    velocity: step.velocity,
    gateTicks: step.gateTicks,
  };
}
