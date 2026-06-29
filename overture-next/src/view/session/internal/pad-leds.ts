import type { CoreSnapshot } from "../../../application/types";
import {
  SESSION_PAD_COUNT,
  clipCellCoordinateForSessionPad,
} from "../../../shared/session-grid";
import type { PadLedView, SurfaceHint } from "../../types";

/**
 * Projects the Session View pad grid: each pad resolves to its Clip Cell and
 * lights playback state before edit focus, so activated/queued Clips do not
 * look the same as merely selected Clip Cells.
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
    const playbackTrack = snapshot.playbackTracks?.find(
      (track) => track.trackIndex === coordinate.trackIndex,
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
    if (clipCell?.clipId && playbackTrack?.queuedClipId === clipCell.clipId)
      state = "queued";
    else if (
      clipCell?.clipId &&
      playbackTrack?.playingClipId === clipCell.clipId
    )
      state = "playing";
    else if (selected && playbackTrack?.queuedStop) state = "queued-stop";
    else if (hinted) state = "hinted";
    else if (selected) state = "selected";
    else if (clipCell?.clipId) state = "occupied";
    else state = "empty";
    return { padIndex, state };
  });
}
