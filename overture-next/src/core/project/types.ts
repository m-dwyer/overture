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

export interface OvertureClip {
  id: ClipId;
  trackIndex: TrackIndex;
  sceneIndex: SceneIndex;
  sequence: Sequence;
}

export interface OvertureProject {
  tracks: TrackState[];
  scenes: SceneState[];
  clipCells: ClipCell[];
  clips: Record<ClipId, OvertureClip>;
  nextClipNumber: number;
}
