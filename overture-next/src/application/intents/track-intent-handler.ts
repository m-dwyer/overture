import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import { assertNever } from "../../shared/assert-never";
import { intentApplied } from "./transaction";
import type { DomainIntentTransaction, TrackIntent } from "./types";

export interface TrackIntentHandler {
  handle(intent: TrackIntent): DomainIntentTransaction;
}

export interface TrackIntentHandlerDependencies {
  readonly control: ControlSurfaceContext;
  readonly project: OvertureProject;
}

export function createTrackIntentHandler({
  control,
  project,
}: TrackIntentHandlerDependencies): TrackIntentHandler {
  return {
    handle(intent) {
      switch (intent.kind) {
        case "select-track":
          project.selectTrackKeepingScene(intent.trackIndex);
          return intentApplied();
        case "select-track-view-page":
          control.selectTrackViewPage(intent.pageId);
          return intentApplied();
        case "toggle-step":
          project.activeClipEditor()?.toggleStep(intent.stepIndex);
          return intentApplied();
        case "audition-note":
          return auditionNote(intent);
        default:
          return assertNever(intent);
      }
    },
  };

  function auditionNote(
    intent: Extract<TrackIntent, { kind: "audition-note" }>,
  ) {
    if (intent.held) control.pressPad(intent.padIndex, intent.velocity);
    else control.releasePad(intent.padIndex);
    const route = project.trackRoute(intent.trackIndex);
    const hostCommand = intent.held
      ? {
          kind: "track-note-on" as const,
          route,
          trackIndex: intent.trackIndex,
          note: intent.note,
          velocity: intent.velocity,
        }
      : {
          kind: "track-note-off" as const,
          route,
          trackIndex: intent.trackIndex,
          note: intent.note,
        };
    return intentApplied([hostCommand]);
  }
}
