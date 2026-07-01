import type { CoreSnapshot } from "../application/types";
import type { SurfaceHostReadModel } from "../ports/surface-host-read-model";
import type { ControlAddress } from "../shared/control-address";
import { selectTrackFromRow } from "../state/surface-addressing";
import { assertNever } from "../shared/assert-never";
import { viewModuleFor } from "./internal/view-modules";
import type {
  LedView,
  OvertureSurfaceView,
  SurfaceHint,
  SurfaceRegion,
} from "./types";

export function createOvertureSurfaceView(
  snapshot: CoreSnapshot,
  hostReadModel: SurfaceHostReadModel = {},
): OvertureSurfaceView {
  const viewModule = viewModuleFor(snapshot);
  const surfaceHints = surfaceHintsFor(snapshot);
  return {
    surfaceHints,
    screen: viewModule.createScreenView(snapshot, hostReadModel),
    leds: createLedView(snapshot, surfaceHints),
  };
}

/**
 * Projects the current context's Surface Affordances into Surface Hints. A hint
 * previews exactly one affordance; because every affordance carries a real
 * Domain Intent, a hint for a non-existent intent cannot be produced here.
 */
function surfaceHintsFor(snapshot: CoreSnapshot): SurfaceHint[] {
  return (snapshot.affordances ?? []).map((affordance) => ({
    surface: regionForTrigger(affordance.trigger),
  }));
}

function regionForTrigger(trigger: ControlAddress): SurfaceRegion {
  switch (trigger.kind) {
    case "track-button":
      return { kind: "track-row", row: trigger.row };
    case "play":
      return { kind: "play" };
    case "menu":
      return { kind: "menu" };
    default:
      return assertNever(trigger);
  }
}

function createLedView(
  snapshot: CoreSnapshot,
  surfaceHints: readonly SurfaceHint[],
): LedView {
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
        colour:
          snapshot.trackColours?.[
            selectTrackFromRow(row, snapshot.visibleTrackBank)
          ],
        state: trackRowLedState(snapshot, surfaceHints, row),
      })),
      { kind: "play", state: snapshot.playing ? "playing" : "stopped" },
      {
        kind: "menu",
        state: snapshot.activeView === "session" ? "session" : "track",
      },
    ],
  };
}

function trackRowLedState(
  snapshot: CoreSnapshot,
  surfaceHints: readonly SurfaceHint[],
  row: number,
): "selected" | "hinted" | "available" {
  // A held-modifier hint previews what a press does now, so it outranks the
  // resting selected highlight.
  if (hasTrackRowHint(surfaceHints, row)) return "hinted";
  if (row === snapshot.selectedTrackIndex % 4) return "selected";
  return "available";
}

function hasTrackRowHint(hints: readonly SurfaceHint[], row: number): boolean {
  return hints.some(
    (hint) => hint.surface.kind === "track-row" && hint.surface.row === row,
  );
}
