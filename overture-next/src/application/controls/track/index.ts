import {
  DEFAULT_TRACK_VIEW_PAGE_ID,
  TRACK_VIEW_SOUND_PAGE_ID,
  type ControlSurfaceContextSnapshot,
} from "../../../state/control-surface-context";
import { selectTrackFromRow } from "../../../state/surface-addressing";
import { noteForTrackPad } from "../../../shared/track-pad-layout";
import type { DomainIntent } from "../../intents/types";
import { trackBankAffordances } from "../track-bank-affordances";
import type {
  ControlInput,
  RootControlContext,
  SurfaceAffordance,
} from "../types";

const SOUND_PAGE_STEP_INDEX = 2;

/**
 * Interprets control input in Track View context.
 * Pad presses and releases both produce audition Domain Intents so note-off can
 * be emitted.
 */
export function interpretTrackViewControl(
  input: ControlInput,
  control: ControlSurfaceContextSnapshot,
): DomainIntent | null {
  if (input.kind === "track-row") {
    return {
      scope: "track",
      kind: "select-track",
      trackIndex: selectTrackFromRow(
        input.row,
        control.heldControls.includes("shift") ? 1 : 0,
      ),
    };
  }
  if (input.kind === "step") {
    if (
      control.heldControls.includes("shift") &&
      input.step === SOUND_PAGE_STEP_INDEX
    )
      return {
        scope: "track",
        kind: "select-track-view-page",
        pageId:
          control.trackView.selectedPageId === TRACK_VIEW_SOUND_PAGE_ID
            ? DEFAULT_TRACK_VIEW_PAGE_ID
            : TRACK_VIEW_SOUND_PAGE_ID,
      };
    return { scope: "track", kind: "toggle-step", stepIndex: input.step };
  }
  if (input.kind !== "pad") return null;
  return {
    scope: "track",
    kind: "audition-note",
    held: input.held,
    padIndex: input.padIndex,
    note: noteForTrackPad(input.padIndex),
    trackIndex: control.selectedTrackIndex,
    velocity: input.velocity,
  };
}

/** Affordances Track View reveals: Track Bank 2 targets while Shift is held. */
export function affordancesTrackView(
  control: ControlSurfaceContextSnapshot,
): SurfaceAffordance[] {
  return trackBankAffordances(control, "track");
}

export const trackRootControlContext: RootControlContext = {
  interpret: interpretTrackViewControl,
  affordances: affordancesTrackView,
};
