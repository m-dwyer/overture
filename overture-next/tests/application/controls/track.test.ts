import { describe, expect, test } from "vitest";
import {
  createInitialControlSurfaceContext,
  DEFAULT_TRACK_VIEW_PAGE_ID,
  TRACK_VIEW_SOUND_PAGE_ID,
} from "../../../src/state/control-surface-context";
import {
  affordancesTrackView,
  interpretTrackViewControl,
} from "../../../src/application/controls/track";

describe("Overture Next Track control interpretation", () => {
  test("interprets pad presses as selected-track note audition", () => {
    const control = createInitialControlSurfaceContext();
    control.selectTrackPreservingScene(5);

    expect(
      interpretTrackViewControl(
        { kind: "pad", held: true, padIndex: 7, velocity: 101 },
        control.snapshot(),
      ),
    ).toEqual({
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
    control.selectTrackPreservingScene(5);

    expect(
      interpretTrackViewControl(
        { kind: "pad", held: false, padIndex: 7, velocity: 0 },
        control.snapshot(),
      ),
    ).toEqual({
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
      interpretTrackViewControl(
        { kind: "track-row", row: 1 },
        control.snapshot(),
      ),
    ).toEqual({
      kind: "select-track",
      trackIndex: 5,
    });
    expect(
      interpretTrackViewControl({ kind: "step", step: 1 }, control.snapshot()),
    ).toEqual({
      kind: "toggle-step",
      stepIndex: 1,
    });
  });

  test("interprets Shift plus Step 3 as Sound page toggle", () => {
    const control = createInitialControlSurfaceContext();
    control.setSurfaceControlHeld("shift", true);

    expect(
      interpretTrackViewControl({ kind: "step", step: 2 }, control.snapshot()),
    ).toEqual({
      kind: "select-track-view-page",
      pageId: TRACK_VIEW_SOUND_PAGE_ID,
    });

    control.selectTrackViewPage("sound");

    expect(
      interpretTrackViewControl({ kind: "step", step: 2 }, control.snapshot()),
    ).toEqual({
      kind: "select-track-view-page",
      pageId: DEFAULT_TRACK_VIEW_PAGE_ID,
    });
  });

  test("affords Track Bank 2 targets while Shift is held", () => {
    const control = createInitialControlSurfaceContext();

    expect(affordancesTrackView(control.snapshot())).toEqual([]);

    control.setSurfaceControlHeld("shift", true);
    expect(affordancesTrackView(control.snapshot())).toEqual([
      {
        trigger: { kind: "track-button", row: 0 },
        intent: { kind: "select-track", trackIndex: 4 },
      },
      {
        trigger: { kind: "track-button", row: 1 },
        intent: { kind: "select-track", trackIndex: 5 },
      },
      {
        trigger: { kind: "track-button", row: 2 },
        intent: { kind: "select-track", trackIndex: 6 },
      },
      {
        trigger: { kind: "track-button", row: 3 },
        intent: { kind: "select-track", trackIndex: 7 },
      },
    ]);
  });
});
