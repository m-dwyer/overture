import type { Sequence } from "../sequence";
import { getTrack } from "../track";
import type { TrackRoute, TrackState } from "../track";
import { findCell, snapshotCell } from "./internal/cells";
import { createDefaultProjectState } from "./internal/default-project";
import type {
  ClipCell,
  ClipCellCoordinate,
  ClipCellSnapshot,
  ClipId,
  OvertureClip,
  ProjectState,
  TrackIndex,
} from "./types";

export { CLIP_CELL_COUNT, SCENE_COUNT } from "./internal/default-project";
export type {
  ClipCell,
  ClipCellCoordinate,
  ClipCellSnapshot,
  ClipId,
  OvertureClip,
  SceneIndex,
  SceneState,
  TrackIndex,
} from "./types";

/**
 * The OvertureProject aggregate: durable owner of Tracks, Overture Scenes,
 * Clip Cells, and Overture Clips. It keeps occupancy and identity state private
 * and exposes read contracts; clip-lifecycle write verbs are added as features
 * require them. A Clip Cell is the single source of truth for clip location.
 */
export class OvertureProject {
  private readonly state: ProjectState;

  constructor(state: ProjectState) {
    this.state = state;
  }

  /** Read-only occupancy at a coordinate. Throws when the coordinate is off-grid. */
  clipCellAt(coordinate: ClipCellCoordinate): ClipCellSnapshot {
    return snapshotCell(this.requireCell(coordinate));
  }

  /** The Overture Clip occupying a coordinate, or null for an Empty Clip Cell. */
  clipFor(coordinate: ClipCellCoordinate): OvertureClip | null {
    const cell = this.requireCell(coordinate);
    if (!cell.clipId) return null;
    return this.state.clips[cell.clipId] ?? null;
  }

  /** The Sequence owned by the clip at a coordinate, or null for an Empty Clip Cell. */
  sequenceFor(coordinate: ClipCellCoordinate): Sequence | null {
    return this.clipFor(coordinate)?.sequence ?? null;
  }

  /** Resolves an Overture Clip by its Clip ID, or null when it no longer exists. */
  clipById(clipId: ClipId): OvertureClip | null {
    return this.state.clips[clipId] ?? null;
  }

  /** Copied Clip Cell occupancy for the whole grid, for read-only projections. */
  clipCellSnapshots(): ClipCellSnapshot[] {
    return this.state.clipCells.map(snapshotCell);
  }

  /** The Track at an index. Throws when the index is out of range. */
  track(trackIndex: TrackIndex): TrackState {
    return getTrack(this.state.tracks, trackIndex);
  }

  /** A copy of the Track Route, so callers cannot mutate Project-owned route state. */
  trackRoute(trackIndex: TrackIndex): TrackRoute {
    return { ...getTrack(this.state.tracks, trackIndex).route };
  }

  private requireCell(coordinate: ClipCellCoordinate): ClipCell {
    const cell = findCell(this.state.clipCells, coordinate);
    if (!cell) throw new Error("Missing clip cell " + coordinate.trackIndex + ":" + coordinate.sceneIndex);
    return cell;
  }
}

export function createDefaultProject(): OvertureProject {
  return new OvertureProject(createDefaultProjectState());
}
