import { describe, expect, test } from "vitest";
import { createInitialControlSurfaceContext } from "../../../src/state/control-surface-context";
import { interpretControl } from "../../../src/application/controls/interpret-control";

describe("Overture Next root control context interpretation", () => {
  test("delegates non-global controls to the active root view context", () => {
    const control = createInitialControlSurfaceContext();
    control.selectTrackPreservingScene(4);

    expect(
      interpretControl(
        { kind: "pad", held: true, padIndex: 26, velocity: 100 },
        control.snapshot(),
      ),
    ).toEqual({
      kind: "launch-clip-cell",
      coordinate: { trackIndex: 4, sceneIndex: 2 },
    });

    control.toggleActiveView();

    expect(
      interpretControl(
        { kind: "pad", held: true, padIndex: 7, velocity: 101 },
        control.snapshot(),
      ),
    ).toEqual({
      kind: "audition-note",
      held: true,
      padIndex: 7,
      note: 67,
      trackIndex: 4,
      velocity: 101,
    });
  });

  test("interprets explicit globals before the active root view context", () => {
    const control = createInitialControlSurfaceContext();

    expect(interpretControl({ kind: "menu" }, control.snapshot())).toEqual({
      kind: "toggle-view",
    });
  });
});
