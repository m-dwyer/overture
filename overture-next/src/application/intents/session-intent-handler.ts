import type { ClipCellCoordinateInput } from "../../domain/project";
import type { OvertureProject } from "../../state/project";
import { assertNever } from "../../shared/assert-never";
import type { Playback } from "../playback";
import type { Transport } from "../transport";
import { intentApplied } from "./transaction";
import type { DomainIntentTransaction, SessionIntent } from "./types";

export interface SessionIntentHandler {
  handle(intent: SessionIntent): DomainIntentTransaction;
}

export interface SessionIntentHandlerDependencies {
  readonly project: OvertureProject;
  readonly playback: Playback;
  readonly transport: Transport;
}

export function createSessionIntentHandler({
  project,
  playback,
  transport,
}: SessionIntentHandlerDependencies): SessionIntentHandler {
  return {
    handle(intent) {
      switch (intent.kind) {
        case "select-track":
          project.selectTrackKeepingScene(intent.trackIndex);
          return intentApplied();
        case "select-clip-cell":
          project.selectClip(intent.coordinate);
          return intentApplied();
        case "launch-clip-cell":
          return launchClipCell(intent.coordinate);
        default:
          return assertNever(intent);
      }
    },
  };

  function launchClipCell(
    coordinate: ClipCellCoordinateInput,
  ): DomainIntentTransaction {
    const selectedBefore = project.selectedClipCell();
    const alreadySelected =
      selectedBefore.trackIndex === coordinate.trackIndex &&
      selectedBefore.sceneIndex === coordinate.sceneIndex;

    project.selectClip(coordinate);
    if (!alreadySelected) return intentApplied();

    return intentApplied(
      playback.requestClipToggle(project, coordinate, {
        running: transport.isPlaying(),
        clock: transport.clock(),
      }),
    );
  }
}
