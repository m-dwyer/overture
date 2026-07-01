import type { ControlSurfaceContext } from "../../state/control-surface-context";
import type { OvertureProject } from "../../state/project";
import { assertNever } from "../../shared/assert-never";
import { intentApplied } from "./transaction";
import type { DomainIntentTransaction, TrackIntent } from "./types";

export class TrackIntentHandler {
  constructor(
    private readonly control: ControlSurfaceContext,
    private readonly project: OvertureProject,
  ) {}

  handle(intent: TrackIntent): DomainIntentTransaction {
    switch (intent.kind) {
      case "select-track":
        this.project.selectTrackKeepingScene(intent.trackIndex);
        return intentApplied();
      case "select-track-view-page":
        this.control.selectTrackViewPage(intent.pageId);
        return intentApplied();
      case "toggle-step":
        this.project.activeClipEditor()?.toggleStep(intent.stepIndex);
        return intentApplied();
      case "audition-note":
        return this.auditionNote(intent);
      default:
        return assertNever(intent);
    }
  }

  private auditionNote(
    intent: Extract<TrackIntent, { kind: "audition-note" }>,
  ): DomainIntentTransaction {
    if (intent.held) this.control.pressPad(intent.padIndex, intent.velocity);
    else this.control.releasePad(intent.padIndex);
    const route = this.project.trackRoute(intent.trackIndex);
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
