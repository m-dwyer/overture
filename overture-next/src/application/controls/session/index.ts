import type { ControlSurfaceContextSnapshot } from "../../../state/control-surface-context";
import { selectTrackFromRow } from "../../../state/surface-addressing";
import { clipCellCoordinateForSessionPad } from "../../../shared/session-grid";
import type { DomainIntent } from "../../intents/types";
import { trackBankAffordances } from "../track-bank-affordances";
import type {
  ControlInputContext,
  ControlInput,
  SurfaceAffordance,
} from "../types";

/**
 * Interprets control input in Session View context.
 * Pad presses address Clip Cells; the operation selects different cells and
 * toggles playback activation for the already selected cell. Pad releases and
 * Step buttons do not produce Domain Intents in this view.
 */
export class SessionControlContext implements ControlInputContext {
  interpret(
    input: ControlInput,
    control: ControlSurfaceContextSnapshot,
  ): DomainIntent | null {
    if (input.kind === "track-row") {
      return {
        scope: "session",
        kind: "select-track",
        trackIndex: selectTrackFromRow(
          input.row,
          control.heldControls.includes("shift") ? 1 : 0,
        ),
      };
    }
    if (input.kind !== "pad") return null;
    if (!input.held) return null;
    return {
      scope: "session",
      kind: "launch-clip-cell",
      coordinate: clipCellCoordinateForSessionPad(
        control.visibleTrackBank,
        input.padIndex,
      ),
    };
  }

  /** Affordances Session View reveals: Track Bank 2 targets while Shift is held. */
  affordances(control: ControlSurfaceContextSnapshot): SurfaceAffordance[] {
    return trackBankAffordances(control, "session");
  }
}
