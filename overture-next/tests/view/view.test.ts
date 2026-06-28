import { describe, expect, test } from "vitest";
import type { CoreSnapshot } from "../../src/core/types";
import { createOvertureSurfaceView } from "../../src/view";

describe("Overture Next view projection", () => {
  test("derives Track View screen and LED views from a core snapshot", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 5,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 1 },
      visibleTrackBank: 1,
      activeView: "track",
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

    const view = createOvertureSurfaceView(snapshot);

    expect(view.surfaceHints).toEqual([]);
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
      { step: 0, state: "active" },
      { step: 1, state: "playhead" },
      { step: 2, state: "off" },
    ]);
    expect(view.leds.buttons).toContainEqual({ kind: "track-row", row: 1, state: "selected" });
    expect(view.leds.buttons).toContainEqual({ kind: "menu", state: "track" });
    expect(view.leds.pads).toHaveLength(32);
    expect(view.leds.pads.every((pad) => pad.state === "off")).toBe(true);
  });

  test("derives a Session View screen and pad LEDs from selected Clip Cell state", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 3,
      selectedTrackRoute: { kind: "move", moveTrackTarget: 3 },
      visibleTrackBank: 0,
      activeView: "session",
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

    const view = createOvertureSurfaceView(snapshot);

    expect(view.surfaceHints).toEqual([]);
    expect(view.screen).toEqual({
      kind: "session",
      title: "OVERTURE NEXT",
      selectedTrackIndex: 3,
      selectedSceneIndex: 7,
      selectedClipId: null,
      playing: false,
    });
    expect(view.leds.pads).toContainEqual({ padIndex: 24, state: "occupied" });
    expect(view.leds.pads).toContainEqual({ padIndex: 7, state: "selected" });
    expect(view.leds.pads).toContainEqual({ padIndex: 8, state: "empty" });
    expect(view.leds.buttons).toContainEqual({ kind: "menu", state: "session" });
  });

  test("derives Surface Hints for the selected Session View scene while Shift is held", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 3,
      selectedTrackRoute: { kind: "move", moveTrackTarget: 3 },
      visibleTrackBank: 0,
      activeView: "session",
      shiftHeld: true,
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

    const view = createOvertureSurfaceView(snapshot);

    expect(view.surfaceHints).toEqual([
      { kind: "scene-launch-target", surface: { kind: "session-scene-column", sceneIndex: 7 } },
    ]);
    expect(view.leds.pads.filter((pad) => pad.state === "hinted")).toEqual([
      { padIndex: 7, state: "hinted" },
      { padIndex: 15, state: "hinted" },
      { padIndex: 23, state: "hinted" },
      { padIndex: 31, state: "hinted" },
    ]);
    expect(view.leds.pads).toContainEqual({ padIndex: 24, state: "occupied" });
    expect(view.leds.pads).toContainEqual({ padIndex: 8, state: "empty" });
  });
});
