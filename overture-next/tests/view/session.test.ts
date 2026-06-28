import { describe, expect, test } from "vitest";
import type { CoreSnapshot } from "../../src/core/types";
import { sessionView } from "../../src/view/session";

describe("Overture Next Session View module", () => {
  test("derives Session View screen data from the selected Clip Cell", () => {
    const snapshot = sessionSnapshot({ shiftHeld: false });

    expect(sessionView.createScreenView(snapshot)).toEqual({
      kind: "session",
      title: "OVERTURE NEXT",
      selectedTrackIndex: 3,
      selectedSceneIndex: 7,
      selectedClipId: null,
      playing: false,
    });
  });

  test("derives scene-launch Surface Hints only while Shift is held", () => {
    expect(sessionView.createSurfaceHints(sessionSnapshot({ shiftHeld: false }))).toEqual([]);
    expect(sessionView.createSurfaceHints(sessionSnapshot({ shiftHeld: true }))).toEqual([
      { kind: "scene-launch-target", surface: { kind: "session-scene-column", sceneIndex: 7 } },
    ]);
  });
});

function sessionSnapshot({ shiftHeld }: { shiftHeld: boolean }): CoreSnapshot {
  return {
    selectedTrackIndex: 3,
    selectedTrackRoute: { kind: "move", moveTrackTarget: 3 },
    visibleTrackBank: 0,
    activeView: "session",
    shiftHeld,
    selectedStep: 0,
    playing: false,
    selectedClipId: null,
    selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
    clipCells: [{ trackIndex: 3, sceneIndex: 7, clipId: null }],
    steps: [{ index: 0, active: true, note: 60, velocity: 100, selected: true, playhead: true }],
  };
}
