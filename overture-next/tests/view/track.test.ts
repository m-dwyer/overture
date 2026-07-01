import { describe, expect, test } from "vitest";
import type { CoreSnapshot } from "../../src/application/types";
import {
  DEFAULT_TRACK_VIEW_PAGE_ID,
  TRACK_VIEW_SOUND_PAGE_ID,
} from "../../src/state/control-surface-context";
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

    expect(trackView.createSurfaceHints(snapshot)).toEqual([]);
    expect(trackView.createScreenView(snapshot)).toEqual({
      kind: "track",
      title: "OVERTURE NEXT",
      selectedTrackIndex: 5,
      playing: true,
      selectedStep: 1,
      trackPage: { kind: "sequence" },
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

    expect(trackView.createSurfaceHints(snapshot)).toEqual([
      { kind: "track-bank-target", surface: { kind: "track-row", row: 0 } },
      { kind: "track-bank-target", surface: { kind: "track-row", row: 1 } },
      { kind: "track-bank-target", surface: { kind: "track-row", row: 2 } },
      { kind: "track-bank-target", surface: { kind: "track-row", row: 3 } },
    ]);
  });

  test("lights Track View pads for notes sounding on the selected Track", () => {
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
      activeNotes: [
        { trackIndex: 5, note: 62, velocity: 100 }, // selected Track -> pad 2 lit
        { trackIndex: 4, note: 60, velocity: 100 }, // other Track -> no pad lit
      ],
      steps: [],
    };

    const pads = trackView.createPadLeds(snapshot, []);

    expect(pads).toHaveLength(32);
    expect(pads[2]).toEqual({ padIndex: 2, state: "playing" });
    expect(pads.filter((pad) => pad.state === "playing")).toEqual([
      { padIndex: 2, state: "playing" },
    ]);
  });

  test("colours the playable pad baseline with the selected Track Colour", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 5,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 1 },
      selectedTrackColour: 5,
      visibleTrackBank: 1,
      activeView: "track",
      heldControls: [],
      selectedStep: 1,
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

    const pads = trackView.createPadLeds(snapshot, []);

    expect(pads[0]).toEqual({ padIndex: 0, state: "playable", colour: 5 });
  });

  test("lights held pads as pressed over the playable baseline", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 5,
      selectedTrackRoute: { kind: "schwung", schwungChainIndex: 1 },
      visibleTrackBank: 1,
      activeView: "track",
      heldControls: [],
      selectedStep: 1,
      playing: false,
      selectedClipId: "clip-6",
      selectedClipCell: { trackIndex: 5, sceneIndex: 0 },
      heldPads: [{ padIndex: 3, velocity: 100 }],
      trackView: {
        selectedPageId: DEFAULT_TRACK_VIEW_PAGE_ID,
        selectedParameterIdByPage: {},
      },
      clipCells: [{ trackIndex: 5, sceneIndex: 0, clipId: "clip-6" }],
      steps: [],
    };

    const pads = trackView.createPadLeds(snapshot, []);

    expect(pads[3]).toEqual({ padIndex: 3, state: "pressed" });
    expect(pads[0]).toEqual({ padIndex: 0, state: "playable" });
  });

  test("derives a Schwung Sound page from selected Track View page and host reads", () => {
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
        selectedPageId: TRACK_VIEW_SOUND_PAGE_ID,
        selectedParameterIdByPage: {},
      },
      clipCells: [{ trackIndex: 5, sceneIndex: 0, clipId: "clip-6" }],
      steps: [],
    };

    expect(
      trackView.createScreenView(snapshot, {
        selectedSchwungChain: {
          chainIndex: 1,
          name: "Slot2",
          synthModule: {
            id: "westfold",
            name: "Westfold",
            parameters: [
              { id: "gain", name: "Gain" },
              { id: "tone", name: "Tone" },
            ],
          },
        },
      }),
    ).toMatchObject({
      kind: "track",
      trackPage: {
        kind: "sound",
        route: "schwung",
        chainIndex: 1,
        chainName: "Slot2",
        synthModuleId: "westfold",
        synthModuleName: "Westfold",
        synthParameters: ["Gain", "Tone"],
      },
    });
  });

  test("derives a conservative Move Sound page placeholder", () => {
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 1,
      selectedTrackRoute: { kind: "move", moveTrackTarget: 1 },
      visibleTrackBank: 0,
      activeView: "track",
      heldControls: [],
      selectedStep: 1,
      playing: false,
      selectedClipId: "clip-2",
      selectedClipCell: { trackIndex: 1, sceneIndex: 0 },
      trackView: {
        selectedPageId: TRACK_VIEW_SOUND_PAGE_ID,
        selectedParameterIdByPage: {},
      },
      clipCells: [{ trackIndex: 1, sceneIndex: 0, clipId: "clip-2" }],
      steps: [],
    };

    expect(trackView.createScreenView(snapshot)).toMatchObject({
      kind: "track",
      trackPage: {
        kind: "sound",
        route: "move",
        moveTrackTarget: 1,
      },
    });
  });
});
