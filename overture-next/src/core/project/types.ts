import type { Sequence } from "../sequence";
import type { TrackState } from "../track";

export type TrackIndex = number;
export type SceneIndex = number;
export type ClipId = string;

export interface ClipCellCoordinate {
  trackIndex: TrackIndex;
  sceneIndex: SceneIndex;
}

export interface SceneState {
  index: SceneIndex;
  name: string;
}

export interface ClipCell {
  trackIndex: TrackIndex;
  sceneIndex: SceneIndex;
  clipId: ClipId | null;
}

export interface ClipCellSnapshot {
  readonly trackIndex: TrackIndex;
  readonly sceneIndex: SceneIndex;
  readonly clipId: ClipId | null;
}

/**
 * An Overture Clip. Its Clip Cell Coordinate is intentionally not stored here:
 * a clip's location is derived from the Clip Cell that holds its Clip ID, which
 * is the single source of truth for occupancy. Do not re-add trackIndex/
 * sceneIndex fields; derive the coordinate from the owning Clip Cell instead.
 */
export interface OvertureClip {
  id: ClipId;
  sequence: Sequence;
}

export interface OvertureProject {
  tracks: TrackState[];
  scenes: SceneState[];
  clipCells: ClipCell[];
  clips: Record<ClipId, OvertureClip>;
  nextClipNumber: number;
}
