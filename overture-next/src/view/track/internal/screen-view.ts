import type { CoreSnapshot } from "../../../core/types";
import type { ScreenView } from "../../types";

export function createTrackScreenView(snapshot: CoreSnapshot): ScreenView {
  return {
    kind: "track",
    title: "OVERTURE NEXT",
    selectedTrackIndex: snapshot.selectedTrackIndex,
    playing: snapshot.playing,
    selectedStep: snapshot.selectedStep,
    steps: snapshot.steps.map((step) => ({
      index: step.index,
      active: step.active,
      selected: step.selected,
      playhead: step.playhead,
    })),
  };
}
