import { createDefaultSequence, type Sequence } from "./sequence";
import { createTracks, TRACK_BANK_SIZE, TRACK_COUNT, type TrackState } from "./track";

export const SCENE_COUNT = 8;
export const CLIP_CELL_COUNT = TRACK_COUNT * SCENE_COUNT;

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
  selectedClipCell: ClipCellCoordinate;
  nextClipNumber: number;
}

export function createDefaultProject(): OvertureProject {
  const project: OvertureProject = {
    tracks: createTracks(),
    scenes: createScenes(),
    clipCells: createClipCells(),
    clips: {},
    selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    nextClipNumber: 1,
  };

  for (let trackIndex = 0; trackIndex < TRACK_COUNT; trackIndex++) {
    createClipInCell(project, { trackIndex, sceneIndex: 0 });
  }

  return project;
}

export function createScenes(sceneCount = SCENE_COUNT): SceneState[] {
  return Array.from({ length: sceneCount }, (_, index) => ({
    index,
    name: "Scene " + (index + 1),
  }));
}

export function createClipCells(trackCount = TRACK_COUNT, sceneCount = SCENE_COUNT): ClipCell[] {
  const clipCells: ClipCell[] = [];
  for (let sceneIndex = 0; sceneIndex < sceneCount; sceneIndex++) {
    for (let trackIndex = 0; trackIndex < trackCount; trackIndex++) {
      clipCells.push({ trackIndex, sceneIndex, clipId: null });
    }
  }
  return clipCells;
}

export function createClipInCell(project: OvertureProject, coordinate: ClipCellCoordinate): OvertureClip {
  const cell = getClipCell(project, coordinate);
  const clip = createOvertureClip("clip-" + project.nextClipNumber, coordinate);
  project.nextClipNumber++;
  project.clips[clip.id] = clip;
  cell.clipId = clip.id;
  return clip;
}

export function createOvertureClip(id: ClipId, coordinate: ClipCellCoordinate): OvertureClip {
  return {
    id,
    trackIndex: coordinate.trackIndex,
    sceneIndex: coordinate.sceneIndex,
    sequence: createDefaultSequence(),
  };
}

export function selectClipCell(project: OvertureProject, coordinate: ClipCellCoordinate): void {
  getClipCell(project, coordinate);
  project.selectedClipCell = { ...coordinate };
}

export function getClipCell(project: OvertureProject, coordinate: ClipCellCoordinate): ClipCell {
  const cell = project.clipCells.find(
    (candidate) => candidate.trackIndex === coordinate.trackIndex && candidate.sceneIndex === coordinate.sceneIndex,
  );
  if (!cell) throw new Error("Missing clip cell " + coordinate.trackIndex + ":" + coordinate.sceneIndex);
  return cell;
}

export function getSelectedClip(project: OvertureProject): OvertureClip | null {
  const cell = getClipCell(project, project.selectedClipCell);
  if (!cell.clipId) return null;
  return project.clips[cell.clipId] ?? null;
}

export function getSelectedSequence(project: OvertureProject): Sequence | null {
  return getSelectedClip(project)?.sequence ?? null;
}

export function visibleTrackRowsForBank(bankIndex: number): TrackIndex[] {
  return Array.from({ length: TRACK_BANK_SIZE }, (_, row) => row + bankIndex * TRACK_BANK_SIZE);
}
