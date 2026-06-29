import type { CoreSnapshot } from "../../../application/types";
import {
  SESSION_PAD_COUNT,
  clipCellCoordinateForSessionPad,
} from "../../../shared/session-grid";
import type { PadLedView, SurfaceHint } from "../../types";

/**
 * Projects the Session View pad grid: each pad resolves to its Clip Cell and
 * lights as hinted, selected, occupied, or empty. The Session View owns both
 * creating its scene-column Surface Hints and reading them here.
 */
export function createSessionPadLeds(
  snapshot: CoreSnapshot,
  surfaceHints: readonly SurfaceHint[],
): PadLedView[] {
  return Array.from({ length: SESSION_PAD_COUNT }, (_, padIndex) => {
    const coordinate = clipCellCoordinateForSessionPad(
      snapshot.visibleTrackBank,
      padIndex,
    );
    const clipCell = snapshot.clipCells.find(
      (cell) =>
        cell.trackIndex === coordinate.trackIndex &&
        cell.sceneIndex === coordinate.sceneIndex,
    );
    const selected =
      snapshot.selectedClipCell.trackIndex === coordinate.trackIndex &&
      snapshot.selectedClipCell.sceneIndex === coordinate.sceneIndex;
    const hinted = surfaceHints.some(
      (hint) =>
        hint.surface.kind === "session-scene-column" &&
        hint.surface.sceneIndex === coordinate.sceneIndex,
    );
    let state: PadLedView["state"];
    if (hinted) state = "hinted";
    else if (selected) state = "selected";
    else if (clipCell?.clipId) state = "occupied";
    else state = "empty";
    return { padIndex, state };
  });
}
