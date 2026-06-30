import type { CoreSnapshot } from "../../../application/types";
import type { SurfaceHostReadModel } from "../../../ports/surface-host-read-model";
import { TRACK_VIEW_SOUND_PAGE_ID } from "../../../state/control-surface-context";
import type { ScreenView, TrackScreenPageView } from "../../types";

export function createTrackScreenView(
  snapshot: CoreSnapshot,
  hostReadModel: SurfaceHostReadModel = {},
): ScreenView {
  return {
    kind: "track",
    title: "OVERTURE NEXT",
    selectedTrackIndex: snapshot.selectedTrackIndex,
    playing: snapshot.playing,
    selectedStep: snapshot.selectedStep,
    trackPage: createTrackScreenPageView(snapshot, hostReadModel),
    steps: snapshot.steps.map((step) => ({
      index: step.index,
      active: step.active,
      selected: step.selected,
      playhead: step.playhead,
    })),
  };
}

function createTrackScreenPageView(
  snapshot: CoreSnapshot,
  hostReadModel: SurfaceHostReadModel,
): TrackScreenPageView {
  if (snapshot.trackView.selectedPageId !== TRACK_VIEW_SOUND_PAGE_ID)
    return { kind: "sequence" };

  if (snapshot.selectedTrackRoute.kind === "move")
    return {
      kind: "sound",
      route: "move",
      moveTrackTarget: snapshot.selectedTrackRoute.moveTrackTarget,
    };

  const chain = hostReadModel.selectedSchwungChain;
  return {
    kind: "sound",
    route: "schwung",
    chainIndex: snapshot.selectedTrackRoute.schwungChainIndex,
    chainName:
      chain?.name ??
      "Chain " + (snapshot.selectedTrackRoute.schwungChainIndex + 1),
    synthModuleId: chain?.synthModule?.id ?? null,
    synthModuleName: chain?.synthModule?.name ?? null,
    synthParameters:
      chain?.synthModule?.parameters.map((parameter) => parameter.name) ?? [],
  };
}
