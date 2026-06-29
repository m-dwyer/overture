export const SESSION_TRACK_ROWS = 4;
export const SESSION_SCENE_COLUMNS = 8;
export const SESSION_PAD_COUNT = SESSION_TRACK_ROWS * SESSION_SCENE_COLUMNS;

export interface SessionGridCoordinate {
  trackIndex: number;
  sceneIndex: number;
}

export function clipCellCoordinateForSessionPad(visibleTrackBank: number, padIndex: number): SessionGridCoordinate {
  const padRowFromBottom = Math.floor(padIndex / SESSION_SCENE_COLUMNS);
  const row = SESSION_TRACK_ROWS - 1 - padRowFromBottom;
  return {
    trackIndex: row + visibleTrackBank * SESSION_TRACK_ROWS,
    sceneIndex: padIndex % SESSION_SCENE_COLUMNS,
  };
}
