import { describe, expect, test } from "vitest";
import { clipCellCoordinate } from "../../../src/domain/project";
import {
  createInitialControlSurfaceContext,
  DEFAULT_TRACK_VIEW_PAGE_ID,
  TRACK_VIEW_SOUND_PAGE_ID,
} from "../../../src/state/control-surface-context";
import { TrackControlContext } from "../../../src/application/controls/track";

describe("Overture Next Track control interpretation", () => {
  const track = new TrackControlContext();

  test("interprets pad presses as selected-track note audition", () => {
    const control = createInitialControlSurfaceContext();

    expect(
      track.interpret(
        { kind: "pad", held: true, padIndex: 7, velocity: 101 },
        control.snapshot(clipCellCoordinate({ trackIndex: 5, sceneIndex: 0 })),
      ),
    ).toEqual({
      scope: "track",
      kind: "audition-note",
      held: true,
      padIndex: 7,
      note: 67,
      trackIndex: 5,
      velocity: 101,
    });
  });

  test("interprets pad releases as selected-track note audition releases", () => {
    const control = createInitialControlSurfaceContext();

    expect(
      track.interpret(
        { kind: "pad", held: false, padIndex: 7, velocity: 0 },
        control.snapshot(clipCellCoordinate({ trackIndex: 5, sceneIndex: 0 })),
      ),
    ).toEqual({
      scope: "track",
      kind: "audition-note",
      held: false,
      padIndex: 7,
      note: 67,
      trackIndex: 5,
      velocity: 0,
    });
  });

  test("interprets track rows and Step buttons in Track View context", () => {
    const control = createInitialControlSurfaceContext();
    control.setSurfaceControlHeld("shift", true);

    expect(
      track.interpret(
        { kind: "track-row", row: 1 },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      scope: "track",
      kind: "select-track",
      trackIndex: 5,
    });
    expect(
      track.interpret(
        { kind: "step", step: 1 },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      scope: "track",
      kind: "toggle-step",
      stepIndex: 1,
    });
  });

  test("interprets Shift plus Step 3 as Sound page toggle", () => {
    const control = createInitialControlSurfaceContext();
    control.setSurfaceControlHeld("shift", true);

    expect(
      track.interpret(
        { kind: "step", step: 2 },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      scope: "track",
      kind: "select-track-view-page",
      pageId: TRACK_VIEW_SOUND_PAGE_ID,
    });

    control.selectTrackViewPage("sound");

    expect(
      track.interpret(
        { kind: "step", step: 2 },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      scope: "track",
      kind: "select-track-view-page",
      pageId: DEFAULT_TRACK_VIEW_PAGE_ID,
    });
  });

  test("affords Track Bank 2 targets while Shift is held", () => {
    const control = createInitialControlSurfaceContext();

    expect(
      track.affordances(
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual([]);

    control.setSurfaceControlHeld("shift", true);
    expect(
      track.affordances(
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual([
      {
        trigger: { kind: "track-button", row: 0 },
        intent: { scope: "track", kind: "select-track", trackIndex: 4 },
      },
      {
        trigger: { kind: "track-button", row: 1 },
        intent: { scope: "track", kind: "select-track", trackIndex: 5 },
      },
      {
        trigger: { kind: "track-button", row: 2 },
        intent: { scope: "track", kind: "select-track", trackIndex: 6 },
      },
      {
        trigger: { kind: "track-button", row: 3 },
        intent: { scope: "track", kind: "select-track", trackIndex: 7 },
      },
    ]);
  });
});
