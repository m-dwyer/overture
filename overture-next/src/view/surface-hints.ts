import type { CoreSnapshot } from "../core/types";
import type { SurfaceHint } from "./types";
import { createSessionSurfaceHints } from "./internal/session-surface-hints";

export function createSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[] {
  if (snapshot.controlMode === "session") return createSessionSurfaceHints(snapshot);
  return [];
}

export function hasSessionSceneColumnHint(hints: readonly SurfaceHint[], sceneIndex: number): boolean {
  return hints.some((hint) => hint.surface.kind === "session-scene-column" && hint.surface.sceneIndex === sceneIndex);
}

export function hasTrackRowHint(hints: readonly SurfaceHint[], row: number): boolean {
  return hints.some((hint) => hint.surface.kind === "track-row" && hint.surface.row === row);
}
