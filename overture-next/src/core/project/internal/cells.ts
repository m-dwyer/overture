import type { Sequence } from "../../sequence";
import type { ClipCell, ClipCellCoordinate, OvertureClip, OvertureProject } from "../types";

export function getClipCell(project: OvertureProject, coordinate: ClipCellCoordinate): ClipCell {
  const cell = project.clipCells.find(
    (candidate) => candidate.trackIndex === coordinate.trackIndex && candidate.sceneIndex === coordinate.sceneIndex,
  );
  if (!cell) throw new Error("Missing clip cell " + coordinate.trackIndex + ":" + coordinate.sceneIndex);
  return cell;
}

export function getClipForCell(project: OvertureProject, coordinate: ClipCellCoordinate): OvertureClip | null {
  const cell = getClipCell(project, coordinate);
  if (!cell.clipId) return null;
  return project.clips[cell.clipId] ?? null;
}

export function getSequenceForCell(project: OvertureProject, coordinate: ClipCellCoordinate): Sequence | null {
  return getClipForCell(project, coordinate)?.sequence ?? null;
}
