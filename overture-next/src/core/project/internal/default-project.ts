import { createDefaultSequence } from "../../sequence";
import { createTracks, TRACK_COUNT } from "../../track";
import type {
  ClipCell,
  ClipCellCoordinate,
  ClipId,
  OvertureClip,
  OvertureProject,
  SceneState,
} from "../types";
import { getClipCell } from "./cells";

export const SCENE_COUNT = 8;
export const CLIP_CELL_COUNT = TRACK_COUNT * SCENE_COUNT;

export function createDefaultProject(): OvertureProject {
  const project: OvertureProject = {
    tracks: createTracks(),
    scenes: createScenes(),
    clipCells: createClipCells(),
    clips: {},
    nextClipNumber: 1,
  };

  for (let trackIndex = 0; trackIndex < TRACK_COUNT; trackIndex++) {
    createClipInCell(project, { trackIndex, sceneIndex: 0 });
  }

  return project;
}

function createScenes(sceneCount = SCENE_COUNT): SceneState[] {
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

function createClipInCell(project: OvertureProject, coordinate: ClipCellCoordinate): OvertureClip {
  const cell = getClipCell(project, coordinate);
  const clip = createOvertureClip("clip-" + project.nextClipNumber, coordinate);
  project.nextClipNumber++;
  project.clips[clip.id] = clip;
  cell.clipId = clip.id;
  return clip;
}

function createOvertureClip(id: ClipId, coordinate: ClipCellCoordinate): OvertureClip {
  return {
    id,
    trackIndex: coordinate.trackIndex,
    sceneIndex: coordinate.sceneIndex,
    sequence: createDefaultSequence(),
  };
}
