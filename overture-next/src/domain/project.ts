import { createDefaultSequence, type Sequence } from "./sequence";
import { createTracks, TRACK_COUNT, type Track } from "./track";
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

export interface OvertureScene {
  index: SceneIndex;
  name: string;
}

export interface ClipCell {
  trackIndex: TrackIndex;
  sceneIndex: SceneIndex;
  clipId: ClipId | null;
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

export interface OvertureProjectData {
  tracks: Track[];
  scenes: OvertureScene[];
  clipCells: ClipCell[];
  clips: Record<ClipId, OvertureClip>;
  nextClipNumber: number;
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

export function createDefaultProjectData(): OvertureProjectData {
  const data: OvertureProjectData = {
    tracks: createTracks(),
    scenes: createScenes(),
    clipCells: createClipCells(),
    clips: {},
    nextClipNumber: 1,
  };

  for (let trackIndexValue = 0; trackIndexValue < TRACK_COUNT; trackIndexValue++) {
    createClipInCell(data, { trackIndex: trackIndexValue, sceneIndex: 0 });
  }

  return data;
}

export function findClipCell(
  cells: readonly ClipCell[],
  coordinateInput: ClipCellCoordinateInput,
): ClipCell | undefined {
  const coordinate = clipCellCoordinate(coordinateInput);
  return cells.find((cell) => cell.trackIndex === coordinate.trackIndex && cell.sceneIndex === coordinate.sceneIndex);
}

function createScenes(sceneCount = SCENE_COUNT): OvertureScene[] {
  return Array.from({ length: sceneCount }, (_, index) => ({
    index: sceneIndex(index),
    name: "Scene " + (index + 1),
  }));
}

function createClipCells(trackCount = TRACK_COUNT, sceneCount = SCENE_COUNT): ClipCell[] {
  const clipCells: ClipCell[] = [];
  for (let sceneIndexValue = 0; sceneIndexValue < sceneCount; sceneIndexValue++) {
    for (let trackIndexValue = 0; trackIndexValue < trackCount; trackIndexValue++) {
      clipCells.push({
        trackIndex: trackIndex(trackIndexValue),
        sceneIndex: sceneIndex(sceneIndexValue),
        clipId: null,
      });
    }
  }
  return clipCells;
}

function createClipInCell(data: OvertureProjectData, coordinate: ClipCellCoordinateInput): OvertureClip {
  const cell = findClipCell(data.clipCells, coordinate);
  if (!cell) throw new Error("Missing clip cell " + coordinate.trackIndex + ":" + coordinate.sceneIndex);
  const clip = createOvertureClip(clipId("clip-" + data.nextClipNumber));
  data.nextClipNumber++;
  data.clips[clip.id] = clip;
  cell.clipId = clip.id;
  return clip;
}

function createOvertureClip(id: ClipId): OvertureClip {
  return {
    id,
    sequence: createDefaultSequence(),
  };
}
