import type { ClipCellCoordinateInput } from "../../domain/project";
import type { OvertureProject } from "../../state/project";
import { assertNever } from "../../shared/assert-never";
import type { Playback } from "../playback";
import type { Transport } from "../transport";
import { intentApplied } from "./transaction";
import type { DomainIntentTransaction, SessionIntent } from "./types";

export class SessionIntentHandler {
  constructor(
    private readonly project: OvertureProject,
    private readonly playback: Playback,
    private readonly transport: Transport,
  ) {}

  handle(intent: SessionIntent): DomainIntentTransaction {
    switch (intent.kind) {
      case "select-track":
        this.project.selectTrackKeepingScene(intent.trackIndex);
        return intentApplied();
      case "select-clip-cell":
        this.project.selectClip(intent.coordinate);
        return intentApplied();
      case "launch-clip-cell":
        return this.launchClipCell(intent.coordinate);
      default:
        return assertNever(intent);
    }
  }

  private launchClipCell(
    coordinate: ClipCellCoordinateInput,
  ): DomainIntentTransaction {
    const selectedBefore = this.project.selectedClipCell();
    const alreadySelected =
      selectedBefore.trackIndex === coordinate.trackIndex &&
      selectedBefore.sceneIndex === coordinate.sceneIndex;

    this.project.selectClip(coordinate);
    if (!alreadySelected) return intentApplied();

    return intentApplied(
      this.playback.requestClipToggle(this.project, coordinate, {
        running: this.transport.isPlaying(),
        clock: this.transport.clock(),
      }),
    );
  }
}
