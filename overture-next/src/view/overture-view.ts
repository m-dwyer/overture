import type { CoreSnapshot } from "../core/types";
import { SESSION_PAD_COUNT, clipCellCoordinateForSessionPad } from "../session-grid";
import { viewModuleFor } from "./internal/view-modules";
import { hasSessionSceneColumnHint, hasTrackRowHint } from "./surface-hints";
import type { LedView, OvertureSurfaceView, ScreenView, SurfaceHint } from "./types";

export function createOvertureSurfaceView(snapshot: CoreSnapshot): OvertureSurfaceView {
  const viewModule = viewModuleFor(snapshot);
  const surfaceHints = viewModule.createSurfaceHints(snapshot);
  return {
    surfaceHints,
    screen: viewModule.createScreenView(snapshot),
    leds: createLedView(snapshot, surfaceHints),
  };
}

export function createScreenView(snapshot: CoreSnapshot): ScreenView {
  return viewModuleFor(snapshot).createScreenView(snapshot);
}

export function createLedView(snapshot: CoreSnapshot, surfaceHints: readonly SurfaceHint[]): LedView {
  return {
    steps: snapshot.steps.map((step) => ({
      step: step.index,
      state: step.playhead ? "playhead" : step.active ? "active" : "off",
    })),
    clipCellPads: createClipCellPadLedView(snapshot, surfaceHints),
    buttons: [
      ...[0, 1, 2, 3].map((row) => ({
        kind: "track-row" as const,
        row,
        state: trackRowLedState(snapshot, surfaceHints, row),
      })),
      { kind: "play", state: snapshot.playing ? "playing" : "stopped" },
      { kind: "menu", state: snapshot.activeView === "session" ? "session" : "track" },
    ],
  };
}

function trackRowLedState(
  snapshot: CoreSnapshot,
  surfaceHints: readonly SurfaceHint[],
  row: number,
): "selected" | "hinted" | "available" {
  if (row === snapshot.selectedTrackIndex % 4) return "selected";
  return hasTrackRowHint(surfaceHints, row) ? "hinted" : "available";
}

function createClipCellPadLedView(snapshot: CoreSnapshot, surfaceHints: readonly SurfaceHint[]): LedView["clipCellPads"] {
  return Array.from({ length: SESSION_PAD_COUNT }, (_, padIndex) => {
    if (snapshot.activeView !== "session") return { padIndex, state: "off" };

    const coordinate = clipCellCoordinateForSessionPad(snapshot.visibleTrackBank, padIndex);
    const clipCell = snapshot.clipCells.find(
      (cell) => cell.trackIndex === coordinate.trackIndex && cell.sceneIndex === coordinate.sceneIndex,
    );
    const selected =
      snapshot.selectedClipCell.trackIndex === coordinate.trackIndex &&
      snapshot.selectedClipCell.sceneIndex === coordinate.sceneIndex;
    const hinted = hasSessionSceneColumnHint(surfaceHints, coordinate.sceneIndex);
    let state: LedView["clipCellPads"][number]["state"];
    if (hinted) state = "hinted";
    else if (selected) state = "selected";
    else if (clipCell?.clipId) state = "occupied";
    else state = "empty";
    return {
      padIndex,
      state,
    };
  });
}
