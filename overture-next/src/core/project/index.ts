import { TRACK_BANK_SIZE } from "../track";
import type { TrackIndex } from "./types";

export { CLIP_CELL_COUNT, SCENE_COUNT, createDefaultProject } from "./internal/default-project";
export { getClipCell, getClipForCell, getSequenceForCell } from "./internal/cells";
export type {
  ClipCell,
  ClipCellCoordinate,
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
