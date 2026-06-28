import type { CoreSnapshot } from "../core/types";
import { viewModuleFor } from "./internal/view-modules";
import type { LedView, OvertureSurfaceView, SurfaceHint } from "./types";

export function createOvertureSurfaceView(snapshot: CoreSnapshot): OvertureSurfaceView {
  const viewModule = viewModuleFor(snapshot);
  const surfaceHints = viewModule.createSurfaceHints(snapshot);
  return {
    surfaceHints,
    screen: viewModule.createScreenView(snapshot),
    leds: createLedView(snapshot, surfaceHints),
  };
}

function createLedView(snapshot: CoreSnapshot, surfaceHints: readonly SurfaceHint[]): LedView {
  return {
    steps: snapshot.steps.map((step) => ({
      step: step.index,
      state: step.playhead ? "playhead" : step.active ? "active" : "off",
    })),
    pads: viewModuleFor(snapshot).createPadLeds(snapshot, surfaceHints),
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

function hasTrackRowHint(hints: readonly SurfaceHint[], row: number): boolean {
  return hints.some((hint) => hint.surface.kind === "track-row" && hint.surface.row === row);
}
