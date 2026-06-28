import type { CoreSnapshot } from "../../../application/types";
import type { SurfaceHint } from "../../types";

export function createSessionSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[] {
  if (!snapshot.shiftHeld) return [];
  return [
    {
      kind: "scene-launch-target",
      surface: { kind: "session-scene-column", sceneIndex: snapshot.selectedClipCell.sceneIndex },
    },
  ];
}
