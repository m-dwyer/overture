import { describe, expect, test } from "vitest";
import { createInitialControlSurfaceContext } from "../../../src/state/control-surface-context";
import { interpretTrackControl } from "../../../src/application/controls/track";

describe("Overture Next Track control interpretation", () => {
  test("interprets pad presses as selected-track note audition", () => {
    const control = createInitialControlSurfaceContext();
    control.selectTrackPreservingScene(5);

    expect(interpretTrackControl({ kind: "pad", held: true, padIndex: 7, velocity: 101 }, control.snapshot())).toEqual({
      kind: "audition-note",
      held: true,
      note: 67,
      trackIndex: 5,
      velocity: 101,
    });
  });

  test("interprets pad releases as selected-track note audition releases", () => {
    const control = createInitialControlSurfaceContext();
    control.selectTrackPreservingScene(5);

    expect(interpretTrackControl({ kind: "pad", held: false, padIndex: 7, velocity: 0 }, control.snapshot())).toEqual({
      kind: "audition-note",
      held: false,
      note: 67,
      trackIndex: 5,
      velocity: 0,
    });
  });

  test("interprets track rows and Step buttons in Track View context", () => {
    const control = createInitialControlSurfaceContext();
    control.setShiftHeld(true);

    expect(interpretTrackControl({ kind: "track-row", row: 1 }, control.snapshot())).toEqual({
      kind: "select-track",
      trackIndex: 5,
    });
    expect(interpretTrackControl({ kind: "step", step: 1 }, control.snapshot())).toEqual({
      kind: "toggle-step",
      stepIndex: 1,
    });
  });
});
