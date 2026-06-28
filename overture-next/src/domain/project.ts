import { createDefaultSequence, type Sequence } from "./sequence";
import { createTracks, TRACK_COUNT, type Track } from "./track";

export type TrackIndex = number;
export type SceneIndex = number;
export type ClipId = string;

export const SCENE_COUNT = 8;
export const CLIP_CELL_COUNT = TRACK_COUNT * SCENE_COUNT;

export interface ClipCellCoordinate {
  trackIndex: TrackIndex;
  sceneIndex: SceneIndex;
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

export function createDefaultProjectData(): OvertureProjectData {
  const data: OvertureProjectData = {
    tracks: createTracks(),
    scenes: createScenes(),
    clipCells: createClipCells(),
    clips: {},
    nextClipNumber: 1,
  };

  for (let trackIndex = 0; trackIndex < TRACK_COUNT; trackIndex++) {
    createClipInCell(data, { trackIndex, sceneIndex: 0 });
  }

  return data;
}

export function findClipCell(
  cells: readonly ClipCell[],
  coordinate: ClipCellCoordinate,
): ClipCell | undefined {
  return cells.find((cell) => cell.trackIndex === coordinate.trackIndex && cell.sceneIndex === coordinate.sceneIndex);
}

function createScenes(sceneCount = SCENE_COUNT): OvertureScene[] {
  return Array.from({ length: sceneCount }, (_, index) => ({
    index,
    name: "Scene " + (index + 1),
  }));
}

function createClipCells(trackCount = TRACK_COUNT, sceneCount = SCENE_COUNT): ClipCell[] {
  const clipCells: ClipCell[] = [];
  for (let sceneIndex = 0; sceneIndex < sceneCount; sceneIndex++) {
    for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
      clipCells.push({ trackIndex, sceneIndex, clipId: null });
    }
  }
  return clipCells;
}

function createClipInCell(data: OvertureProjectData, coordinate: ClipCellCoordinate): OvertureClip {
  const cell = findClipCell(data.clipCells, coordinate);
  if (!cell) throw new Error("Missing clip cell " + coordinate.trackIndex + ":" + coordinate.sceneIndex);
  const clip = createOvertureClip("clip-" + data.nextClipNumber);
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
