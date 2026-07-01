import { describe, expect, test } from "vitest";
import type { CoreSnapshot } from "../../src/application/types";
import { DEFAULT_TRACK_VIEW_PAGE_ID } from "../../src/state/control-surface-context";
import { sessionView } from "../../src/view/session";

describe("Overture Next Session View module", () => {
  test("derives Session View screen data from the selected Clip Cell", () => {
    const snapshot = sessionSnapshot({ heldControls: [] });

    expect(sessionView.createScreenView(snapshot)).toEqual({
      kind: "session",
      title: "OVERTURE NEXT",
      selectedTrackIndex: 3,
      selectedSceneIndex: 7,
      selectedClipId: null,
      playing: false,
    });
  });
});

function sessionSnapshot({
  heldControls,
}: {
  heldControls: CoreSnapshot["heldControls"];
}): CoreSnapshot {
  return {
    selectedTrackIndex: 3,
    selectedTrackRoute: { kind: "move", moveTrackTarget: 3 },
    visibleTrackBank: 0,
    activeView: "session",
    heldControls,
    selectedStep: 0,
    playing: false,
    selectedClipId: null,
    selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
    trackView: {
      selectedPageId: DEFAULT_TRACK_VIEW_PAGE_ID,
      selectedParameterIdByPage: {},
    },
    clipCells: [{ trackIndex: 3, sceneIndex: 7, clipId: null }],
    steps: [
      {
        index: 0,
        active: true,
        note: 60,
        velocity: 100,
        selected: true,
        playhead: true,
      },
    ],
  };
}
