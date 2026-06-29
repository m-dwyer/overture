import { describe, expect, test } from "vitest";
import type { CoreSnapshot } from "../../src/application/types";
import { trackView } from "../../src/view/track";

describe("Overture Next Track View module", () => {
  test("derives Track View screen data and no Surface Hints", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 5,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 1 },
      visibleTrackBank: 1,
      activeView: "track",
      heldControls: [],
      selectedStep: 1,
      playing: true,
      selectedClipId: "clip-6",
      selectedClipCell: { trackIndex: 5, sceneIndex: 0 },
      clipCells: [{ trackIndex: 5, sceneIndex: 0, clipId: "clip-6" }],
      steps: [
        {
          index: 0,
          active: true,
          note: 60,
          velocity: 100,
          selected: false,
          playhead: false,
        },
        {
          index: 1,
          active: false,
          note: 61,
          velocity: 100,
          selected: true,
          playhead: true,
        },
      ],
    };

    expect(trackView.createSurfaceHints(snapshot)).toEqual([]);
    expect(trackView.createScreenView(snapshot)).toEqual({
      kind: "track",
      title: "OVERTURE NEXT",
      selectedTrackIndex: 5,
      playing: true,
      selectedStep: 1,
      steps: [
        { index: 0, active: true, selected: false, playhead: false },
        { index: 1, active: false, selected: true, playhead: true },
      ],
    });
  });

  test("derives track-row Surface Hints while Shift is held", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 5,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 1 },
      visibleTrackBank: 1,
      activeView: "track",
      heldControls: ["shift"],
      selectedStep: 1,
      playing: true,
      selectedClipId: "clip-6",
      selectedClipCell: { trackIndex: 5, sceneIndex: 0 },
      clipCells: [{ trackIndex: 5, sceneIndex: 0, clipId: "clip-6" }],
      steps: [
        {
          index: 0,
          active: true,
          note: 60,
          velocity: 100,
          selected: false,
          playhead: false,
        },
        {
          index: 1,
          active: false,
          note: 61,
          velocity: 100,
          selected: true,
          playhead: true,
        },
      ],
    };

    expect(trackView.createSurfaceHints(snapshot)).toEqual([
      { kind: "track-bank-target", surface: { kind: "track-row", row: 0 } },
      { kind: "track-bank-target", surface: { kind: "track-row", row: 1 } },
      { kind: "track-bank-target", surface: { kind: "track-row", row: 2 } },
      { kind: "track-bank-target", surface: { kind: "track-row", row: 3 } },
    ]);
  });
});
