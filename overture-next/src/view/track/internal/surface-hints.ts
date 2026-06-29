import type { CoreSnapshot } from "../../../application/types";
import type { SurfaceHint } from "../../types";

export function createTrackSurfaceHints(snapshot: CoreSnapshot): SurfaceHint[] {
  if (!snapshot.heldControls.includes("shift")) return [];
  return [0, 1, 2, 3].map((row) => ({
    kind: "track-bank-target",
    surface: { kind: "track-row", row },
  }));
}
