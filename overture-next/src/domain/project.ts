import { TRACK_COUNT } from "./track";
import { integerInRange, nonEmptyString, type Branded } from "./value-objects";

export type TrackIndex = Branded<number, "TrackIndex">;
export type SceneIndex = Branded<number, "SceneIndex">;
export type ClipId = Branded<string, "ClipId">;

export const SCENE_COUNT = 8;
export const CLIP_CELL_COUNT = TRACK_COUNT * SCENE_COUNT;

export interface ClipCellCoordinate {
  readonly trackIndex: TrackIndex;
  readonly sceneIndex: SceneIndex;
}

export interface ClipCellCoordinateInput {
  readonly trackIndex: number;
  readonly sceneIndex: number;
}

export function trackIndex(value: number): TrackIndex {
  return integerInRange("Track Index", value, TRACK_COUNT) as TrackIndex;
}

export function parseTrackIndex(value: number): TrackIndex | null {
  try {
    return trackIndex(value);
  } catch {
    return null;
  }
}

export function sceneIndex(value: number): SceneIndex {
  return integerInRange("Scene Index", value, SCENE_COUNT) as SceneIndex;
}

export function parseSceneIndex(value: number): SceneIndex | null {
  try {
    return sceneIndex(value);
  } catch {
    return null;
  }
}

export function clipId(value: string): ClipId {
  return nonEmptyString("Clip ID", value) as ClipId;
}

export function clipCellCoordinate(input: ClipCellCoordinateInput): ClipCellCoordinate {
  return {
    trackIndex: trackIndex(input.trackIndex),
    sceneIndex: sceneIndex(input.sceneIndex),
  };
}
