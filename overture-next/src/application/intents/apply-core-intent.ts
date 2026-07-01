import type { CoreOwners } from "../core-owners";
import { assertNever } from "../../shared/assert-never";
import {
  auditionNote,
  launchClipCell,
  selectClipCell,
  selectTrackViewPage,
  selectTrack,
  setSurfaceControlHeld,
  toggleSelectedStep,
  toggleTransportPlayback,
  toggleView,
} from "../operations";
import type { DomainIntent, DomainIntentTransaction } from "./types";

export function applyCoreIntent(
  intent: DomainIntent,
  owners: CoreOwners,
): DomainIntentTransaction {
  switch (intent.kind) {
    case "set-surface-control-held":
      return setSurfaceControlHeld(
        { control: owners.control },
        intent.control,
        intent.held,
      );
    case "toggle-transport-playback":
      return toggleTransportPlayback({
        project: owners.project,
        playback: owners.playback,
        transport: owners.transport,
      });
    case "toggle-view":
      return toggleView({ control: owners.control });
    case "select-track-view-page":
      return selectTrackViewPage({ control: owners.control }, intent.pageId);
    case "select-track":
      return selectTrack(
        { control: owners.control, project: owners.project },
        intent.trackIndex,
      );
    case "toggle-step":
      return toggleSelectedStep(
        { control: owners.control, project: owners.project },
        intent.stepIndex,
      );
    case "audition-note":
      return auditionNote(
        { control: owners.control, project: owners.project },
        intent,
      );
    case "select-clip-cell":
      return selectClipCell(
        { control: owners.control, project: owners.project },
        intent.coordinate,
      );
    case "launch-clip-cell":
      return launchClipCell(
        {
          control: owners.control,
          project: owners.project,
          playback: owners.playback,
          transport: owners.transport,
        },
        intent.coordinate,
      );
    default:
      return assertNever(intent);
  }
}
