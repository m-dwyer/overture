import type { CoreSnapshot } from "../../../core/types";
import type { ScreenView } from "../../types";

export function createSessionScreenView(snapshot: CoreSnapshot): ScreenView {
  return {
    kind: "session",
    title: "OVERTURE NEXT",
    selectedTrackIndex: snapshot.selectedTrackIndex,
    selectedSceneIndex: snapshot.selectedClipCell.sceneIndex,
    selectedClipId: snapshot.selectedClipId,
    playing: snapshot.playing,
  };
}
