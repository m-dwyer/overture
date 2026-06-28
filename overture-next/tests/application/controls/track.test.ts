import { describe, expect, test } from "vitest";
import { createInitialControlState } from "../../../src/state/control-state";
import { interpretTrackControl } from "../../../src/application/controls/track";

describe("Overture Next Track control interpretation", () => {
  test("interprets pad presses as selected-track note audition", () => {
    const control = createInitialControlState();
    control.selectTrack(5);

    expect(interpretTrackControl({ kind: "pad", held: true, padIndex: 7, velocity: 101 }, control.snapshot())).toEqual({
      kind: "audition-note",
      held: true,
      note: 67,
      trackIndex: 5,
      velocity: 101,
    });
  });

  test("interprets pad releases as selected-track note audition releases", () => {
    const control = createInitialControlState();
    control.selectTrack(5);

    expect(interpretTrackControl({ kind: "pad", held: false, padIndex: 7, velocity: 0 }, control.snapshot())).toEqual({
      kind: "audition-note",
      held: false,
      note: 67,
      trackIndex: 5,
      velocity: 0,
    });
  });
});
