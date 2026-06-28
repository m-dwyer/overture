import type { CoreSnapshot } from "../core/types";

export type SurfaceRegion =
  | { kind: "session-scene-column"; sceneIndex: number }
  | { kind: "track-row"; row: number };

export type SurfaceHint = { kind: "scene-launch-target"; surface: SurfaceRegion };

export function createSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[] {
  if (snapshot.controlMode !== "session" || !snapshot.shiftHeld) return [];
  return [
    {
      kind: "scene-launch-target",
      surface: { kind: "session-scene-column", sceneIndex: snapshot.selectedClipCell.sceneIndex },
    },
  ];
}

export function hasSessionSceneColumnHint(hints: readonly SurfaceHint[], sceneIndex: number): boolean {
  return hints.some((hint) => hint.surface.kind === "session-scene-column" && hint.surface.sceneIndex === sceneIndex);
}

export function hasTrackRowHint(hints: readonly SurfaceHint[], row: number): boolean {
  return hints.some((hint) => hint.surface.kind === "track-row" && hint.surface.row === row);
}
