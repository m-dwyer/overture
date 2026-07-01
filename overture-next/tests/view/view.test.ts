import { describe, expect, test } from "vitest";
import type { CoreSnapshot } from "../../src/application/types";
import { DEFAULT_TRACK_VIEW_PAGE_ID } from "../../src/state/control-surface-context";
import { createOvertureSurfaceView } from "../../src/view";

describe("Overture Next view projection", () => {
  test("derives Track View screen and LED views from a core snapshot", () => {
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
      trackView: {
        selectedPageId: DEFAULT_TRACK_VIEW_PAGE_ID,
        selectedParameterIdByPage: {},
      },
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
        {
          index: 2,
          active: false,
          note: 62,
          velocity: 100,
          selected: false,
          playhead: false,
        },
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
      trackPage: { kind: "sequence" },
    });
    if (view.screen.kind !== "track")
      throw new Error("Expected Track View screen");
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
    expect(view.leds.buttons).toContainEqual({
      kind: "track-row",
      row: 1,
      state: "selected",
    });
    expect(view.leds.buttons).toContainEqual({ kind: "menu", state: "track" });
    expect(view.leds.pads).toHaveLength(32);
    expect(view.leds.pads.every((pad) => pad.state === "playable")).toBe(true);
  });

  test("colours each visible track-row button with its Track's colour", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 5,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 1 },
      trackColours: [0, 1, 2, 3, 4, 5, 6, 7],
      visibleTrackBank: 1,
      activeView: "track",
      heldControls: [],
      selectedStep: 0,
      playing: false,
      selectedClipId: "clip-6",
      selectedClipCell: { trackIndex: 5, sceneIndex: 0 },
      trackView: {
        selectedPageId: DEFAULT_TRACK_VIEW_PAGE_ID,
        selectedParameterIdByPage: {},
      },
      clipCells: [{ trackIndex: 5, sceneIndex: 0, clipId: "clip-6" }],
      steps: [],
    };

    const view = createOvertureSurfaceView(snapshot);

    // Track Bank 2: row 0 -> Track 4, row 1 -> Track 5 (selected).
    expect(view.leds.buttons).toContainEqual({
      kind: "track-row",
      row: 0,
      colour: 4,
      state: "available",
    });
    expect(view.leds.buttons).toContainEqual({
      kind: "track-row",
      row: 1,
      colour: 5,
      state: "selected",
    });
  });

  test("derives Track View track-row button hints while Shift is held", () => {
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
      trackView: {
        selectedPageId: DEFAULT_TRACK_VIEW_PAGE_ID,
        selectedParameterIdByPage: {},
      },
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

    const view = createOvertureSurfaceView(snapshot);

    expect(view.surfaceHints).toEqual([
      { kind: "track-bank-target", surface: { kind: "track-row", row: 0 } },
      { kind: "track-bank-target", surface: { kind: "track-row", row: 1 } },
      { kind: "track-bank-target", surface: { kind: "track-row", row: 2 } },
      { kind: "track-bank-target", surface: { kind: "track-row", row: 3 } },
    ]);
    expect(view.leds.buttons).toContainEqual({
      kind: "track-row",
      row: 0,
      state: "hinted",
    });
    expect(view.leds.buttons).toContainEqual({
      kind: "track-row",
      row: 1,
      state: "selected",
    });
    expect(view.leds.buttons).toContainEqual({
      kind: "track-row",
      row: 2,
      state: "hinted",
    });
    expect(view.leds.buttons).toContainEqual({
      kind: "track-row",
      row: 3,
      state: "hinted",
    });
  });

  test("derives a Session View screen and pad LEDs from selected Clip Cell state", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 3,
      selectedTrackRoute: { kind: "move", moveTrackTarget: 3 },
      visibleTrackBank: 0,
      activeView: "session",
      heldControls: [],
      selectedStep: 0,
      playing: false,
      selectedClipId: null,
      selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
      trackView: {
        selectedPageId: DEFAULT_TRACK_VIEW_PAGE_ID,
        selectedParameterIdByPage: {},
      },
      clipCells: [
        { trackIndex: 0, sceneIndex: 0, clipId: "clip-1" },
        { trackIndex: 1, sceneIndex: 0, clipId: "clip-2" },
        { trackIndex: 2, sceneIndex: 0, clipId: "clip-3" },
        { trackIndex: 3, sceneIndex: 7, clipId: null },
      ],
      playbackTracks: [
        {
          trackIndex: 0,
          playingClipId: "clip-1",
          queuedClipId: null,
          queuedStop: false,
        },
        {
          trackIndex: 1,
          playingClipId: null,
          queuedClipId: "clip-2",
          queuedStop: false,
        },
        {
          trackIndex: 3,
          playingClipId: "clip-4",
          queuedClipId: null,
          queuedStop: true,
        },
      ],
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
    expect(view.leds.pads).toContainEqual({ padIndex: 24, state: "playing" });
    expect(view.leds.pads).toContainEqual({ padIndex: 16, state: "queued" });
    expect(view.leds.pads).toContainEqual({ padIndex: 8, state: "occupied" });
    expect(view.leds.pads).toContainEqual({
      padIndex: 7,
      state: "queued-stop",
    });
    expect(view.leds.pads).toContainEqual({ padIndex: 9, state: "empty" });
    expect(view.leds.buttons).toContainEqual({
      kind: "menu",
      state: "session",
    });
  });

  test("derives Surface Hints for the selected Session View scene while Shift is held", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 3,
      selectedTrackRoute: { kind: "move", moveTrackTarget: 3 },
      visibleTrackBank: 0,
      activeView: "session",
      heldControls: ["shift"],
      selectedStep: 0,
      playing: false,
      selectedClipId: null,
      selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
      trackView: {
        selectedPageId: DEFAULT_TRACK_VIEW_PAGE_ID,
        selectedParameterIdByPage: {},
      },
      clipCells: [
        { trackIndex: 0, sceneIndex: 0, clipId: "clip-1" },
        { trackIndex: 3, sceneIndex: 7, clipId: null },
      ],
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

    const view = createOvertureSurfaceView(snapshot);

    expect(view.surfaceHints).toEqual([
      {
        kind: "scene-launch-target",
        surface: { kind: "session-scene-column", sceneIndex: 7 },
      },
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
