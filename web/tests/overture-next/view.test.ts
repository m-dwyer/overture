import { describe, expect, test } from "vitest";
import type { CoreSnapshot } from "../../../overture-next/src/core/types";
import { createOvertureView } from "../../../overture-next/src/view/overture-view";

describe("Overture Next view projection", () => {
  test("derives screen and LED views from a core snapshot", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      sessionView: true,
      selectedStep: 1,
      playing: true,
      selectedClipId: "clip-6",
      selectedClipCell: { trackIndex: 5, sceneIndex: 0 },
      steps: [
        { index: 0, active: true, note: 60, velocity: 100, selected: false, playhead: false },
        { index: 1, active: false, note: 61, velocity: 100, selected: true, playhead: true },
        { index: 2, active: false, note: 62, velocity: 100, selected: false, playhead: false },
      ],
    };

    const view = createOvertureView(snapshot);

    expect(view.screen).toMatchObject({
      kind: "track",
      title: "OVERTURE NEXT",
      mode: "session",
      selectedTrackIndex: 5,
      playing: true,
      selectedStep: 1,
    });
    expect(view.screen.steps).toEqual([
      { index: 0, active: true, selected: false, playhead: false },
      { index: 1, active: false, selected: true, playhead: true },
      { index: 2, active: false, selected: false, playhead: false },
    ]);
    expect(view.leds.steps).toEqual([
      { step: 0, color: 48 },
      { step: 1, color: 120 },
      { step: 2, color: 0 },
    ]);
    expect(view.leds.buttons).toContainEqual({ kind: "track-row", row: 1, color: 120 });
    expect(view.leds.buttons).toContainEqual({ kind: "menu", color: 44 });
  });
});
