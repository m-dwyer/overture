import type { ControlSurfaceContextSnapshot } from "../../state/control-surface-context";
import { selectTrackFromRow } from "../../state/surface-addressing";
import type { SurfaceAffordance } from "./types";
import type { SessionIntent, TrackIntent } from "../intents/types";

type TrackSelectionIntentScope = SessionIntent["scope"] | TrackIntent["scope"];

/**
 * While Shift is held, each track (side) button addresses the same-row Track in
 * Track Bank 2. Shared by both root views, using the same bank rule as
 * interpretation so the preview and the action cannot diverge.
 */
export function trackBankAffordances(
  control: ControlSurfaceContextSnapshot,
  scope: TrackSelectionIntentScope,
): SurfaceAffordance[] {
  if (!control.heldControls.includes("shift")) return [];
  return [0, 1, 2, 3].map((row) => ({
    trigger: { kind: "track-button", row },
    intent: {
      scope,
      kind: "select-track",
      trackIndex: selectTrackFromRow(row, 1),
    },
  }));
}
