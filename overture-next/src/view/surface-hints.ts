import type { CoreSnapshot } from "../core/types";
import { viewModuleFor } from "./internal/view-modules";
import type { SurfaceHint } from "./types";

export function createSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[] {
  return viewModuleFor(snapshot).createSurfaceHints(snapshot);
}

export function hasSessionSceneColumnHint(hints: readonly SurfaceHint[], sceneIndex: number): boolean {
  return hints.some((hint) => hint.surface.kind === "session-scene-column" && hint.surface.sceneIndex === sceneIndex);
}

export function hasTrackRowHint(hints: readonly SurfaceHint[], row: number): boolean {
  return hints.some((hint) => hint.surface.kind === "track-row" && hint.surface.row === row);
}
