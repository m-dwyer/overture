import { getTrack, TRACK_BANK_SIZE } from "../track";
import type { TrackRoute } from "../track";
import type { OvertureProject, TrackIndex } from "./types";

export { CLIP_CELL_COUNT, SCENE_COUNT, createDefaultProject } from "./internal/default-project";
export { getClipCell, getClipForCell, getSequenceForCell, listClipCellSnapshots } from "./internal/cells";
export type {
  ClipCell,
  ClipCellCoordinate,
  ClipCellSnapshot,
  ClipId,
  OvertureClip,
  OvertureProject,
  SceneIndex,
  SceneState,
  TrackIndex,
} from "./types";

export function visibleTrackRowsForBank(bankIndex: number): TrackIndex[] {
  return Array.from({ length: TRACK_BANK_SIZE }, (_, row) => row + bankIndex * TRACK_BANK_SIZE);
}

/**
 * Resolves a Track Route through the Project container without exposing Track storage.
 */
export function getProjectTrackRoute(project: OvertureProject, trackIndex: TrackIndex): TrackRoute {
  return { ...getTrack(project.tracks, trackIndex).route };
}
