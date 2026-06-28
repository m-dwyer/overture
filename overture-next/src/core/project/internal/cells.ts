import type { ClipCell, ClipCellCoordinate, ClipCellSnapshot } from "../types";

/**
 * Locates the Clip Cell at a coordinate, or undefined when the coordinate is
 * outside the project grid. Pure helper for the OvertureProject owner-object.
 */
export function findCell(cells: readonly ClipCell[], coordinate: ClipCellCoordinate): ClipCell | undefined {
  return cells.find(
    (candidate) => candidate.trackIndex === coordinate.trackIndex && candidate.sceneIndex === coordinate.sceneIndex,
  );
}

/**
 * Returns copied Clip Cell occupancy for read-only projections.
 */
export function snapshotCell(cell: ClipCell): ClipCellSnapshot {
  return {
    trackIndex: cell.trackIndex,
    sceneIndex: cell.sceneIndex,
    clipId: cell.clipId,
  };
}
