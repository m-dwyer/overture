import { describe, expect, test } from "vitest";
import type { CoreSnapshot } from "../../../overture-next/src/core/types";
import { createOvertureView } from "../../../overture-next/src/view/overture-view";

describe("Overture Next view projection", () => {
  test("derives Track View screen and LED views from a core snapshot", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 5,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 1 },
      visibleTrackBank: 1,
      controlMode: "track",
      shiftHeld: false,
      selectedStep: 1,
      playing: true,
      selectedClipId: "clip-6",
      selectedClipCell: { trackIndex: 5, sceneIndex: 0 },
      clipCells: [{ trackIndex: 5, sceneIndex: 0, clipId: "clip-6" }],
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
      selectedTrackIndex: 5,
      playing: true,
      selectedStep: 1,
    });
    if (view.screen.kind !== "track") throw new Error("Expected Track View screen");
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
    expect(view.leds.buttons).toContainEqual({ kind: "track-row", row: 1, state: "selected" });
    expect(view.leds.buttons).toContainEqual({ kind: "menu", color: 8 });
    expect(view.leds.clipCellPads).toHaveLength(32);
    expect(view.leds.clipCellPads.every((pad) => pad.state === "off")).toBe(true);
  });

  test("derives a Session View screen and pad LEDs from selected Clip Cell state", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 3,
      selectedTrackRoute: { kind: "move", moveTrackTarget: 3 },
      visibleTrackBank: 0,
      controlMode: "session",
      shiftHeld: false,
      selectedStep: 0,
      playing: false,
      selectedClipId: null,
      selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
      clipCells: [
        { trackIndex: 0, sceneIndex: 0, clipId: "clip-1" },
        { trackIndex: 3, sceneIndex: 7, clipId: null },
      ],
      steps: [
        { index: 0, active: true, note: 60, velocity: 100, selected: true, playhead: true },
      ],
    };

    const view = createOvertureView(snapshot);

    expect(view.screen).toEqual({
      kind: "session",
      title: "OVERTURE NEXT",
      selectedTrackIndex: 3,
      selectedSceneIndex: 7,
      selectedClipId: null,
      playing: false,
    });
    expect(view.leds.clipCellPads).toContainEqual({ padIndex: 24, state: "occupied" });
    expect(view.leds.clipCellPads).toContainEqual({ padIndex: 7, state: "selected" });
    expect(view.leds.clipCellPads).toContainEqual({ padIndex: 8, state: "empty" });
    expect(view.leds.buttons).toContainEqual({ kind: "menu", color: 44 });
  });

  test("derives Surface Hints for track rows while Shift is held", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 1,
      selectedTrackRoute: { kind: "move", moveTrackTarget: 1 },
      visibleTrackBank: 0,
      controlMode: "track",
      shiftHeld: true,
      selectedStep: 0,
      playing: false,
      selectedClipId: "clip-2",
      selectedClipCell: { trackIndex: 1, sceneIndex: 0 },
      clipCells: [{ trackIndex: 1, sceneIndex: 0, clipId: "clip-2" }],
      steps: [
        { index: 0, active: true, note: 60, velocity: 100, selected: true, playhead: true },
      ],
    };

    const view = createOvertureView(snapshot);

    expect(view.leds.buttons).toContainEqual({ kind: "track-row", row: 1, state: "selected" });
    expect(view.leds.buttons).toContainEqual({ kind: "track-row", row: 0, state: "hinted" });
    expect(view.leds.buttons).toContainEqual({ kind: "track-row", row: 2, state: "hinted" });
    expect(view.leds.buttons).toContainEqual({ kind: "track-row", row: 3, state: "hinted" });
  });
});
