import { createDefaultSequence } from "../../sequence";
import { createTracks, TRACK_COUNT } from "../../track";
import type {
  ClipCell,
  ClipCellCoordinate,
  ClipId,
  OvertureClip,
  ProjectState,
  SceneState,
} from "../types";
import { findCell } from "./cells";

export const SCENE_COUNT = 8;
export const CLIP_CELL_COUNT = TRACK_COUNT * SCENE_COUNT;

export function createDefaultProjectState(): ProjectState {
  const state: ProjectState = {
    tracks: createTracks(),
    scenes: createScenes(),
    clipCells: createClipCells(),
    clips: {},
    nextClipNumber: 1,
  };

  for (let trackIndex = 0; trackIndex < TRACK_COUNT; trackIndex++) {
    createClipInCell(state, { trackIndex, sceneIndex: 0 });
  }

  return state;
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

function createClipInCell(state: ProjectState, coordinate: ClipCellCoordinate): OvertureClip {
  const cell = findCell(state.clipCells, coordinate);
  if (!cell) throw new Error("Missing clip cell " + coordinate.trackIndex + ":" + coordinate.sceneIndex);
  const clip = createOvertureClip("clip-" + state.nextClipNumber);
  state.nextClipNumber++;
  state.clips[clip.id] = clip;
  cell.clipId = clip.id;
  return clip;
}

function createOvertureClip(id: ClipId): OvertureClip {
  return {
    id,
    sequence: createDefaultSequence(),
  };
}
