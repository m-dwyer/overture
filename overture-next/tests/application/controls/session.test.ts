import { describe, expect, test } from "vitest";
import { createInitialControlSurfaceContext } from "../../../src/state/control-surface-context";
import { interpretSessionViewControl } from "../../../src/application/controls/session";

describe("Overture Next Session control interpretation", () => {
  test("interprets pad presses as visible-bank Clip Cell launches", () => {
    const control = createInitialControlSurfaceContext();
    control.selectTrackPreservingScene(4);

    const intent = interpretSessionViewControl(
      { kind: "pad", held: true, padIndex: 26, velocity: 100 },
      control.snapshot(),
    );

    expect(intent).toEqual({
      kind: "launch-clip-cell",
      coordinate: { trackIndex: 4, sceneIndex: 2 },
    });
    expect(intent).not.toHaveProperty("padIndex");
  });

  test("ignores pad releases", () => {
    const control = createInitialControlSurfaceContext();

    expect(
      interpretSessionViewControl(
        { kind: "pad", held: false, padIndex: 26, velocity: 0 },
        control.snapshot(),
      ),
    ).toBeNull();
  });

  test("interprets track rows in Session View without treating Step buttons as hidden sequence edits", () => {
    const control = createInitialControlSurfaceContext();
    control.setSurfaceControlHeld("shift", true);

    expect(
      interpretSessionViewControl(
        { kind: "track-row", row: 1 },
        control.snapshot(),
      ),
    ).toEqual({
      kind: "select-track",
      trackIndex: 5,
    });
    expect(
      interpretSessionViewControl(
        { kind: "step", step: 1 },
        control.snapshot(),
      ),
    ).toBeNull();
  });
});
