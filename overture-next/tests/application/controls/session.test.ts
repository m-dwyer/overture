import { describe, expect, test } from "vitest";
import { clipCellCoordinate } from "../../../src/domain/project";
import { createInitialControlSurfaceContext } from "../../../src/state/control-surface-context";
import {
  affordancesSessionView,
  interpretSessionViewControl,
} from "../../../src/application/controls/session";

describe("Overture Next Session control interpretation", () => {
  test("interprets pad presses as visible-bank Clip Cell launches", () => {
    const control = createInitialControlSurfaceContext();

    const intent = interpretSessionViewControl(
      { kind: "pad", held: true, padIndex: 26, velocity: 100 },
      control.snapshot(clipCellCoordinate({ trackIndex: 4, sceneIndex: 0 })),
    );

    expect(intent).toEqual({
      scope: "session",
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
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toBeNull();
  });

  test("interprets track rows in Session View without treating Step buttons as hidden sequence edits", () => {
    const control = createInitialControlSurfaceContext();
    control.setSurfaceControlHeld("shift", true);

    expect(
      interpretSessionViewControl(
        { kind: "track-row", row: 1 },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      scope: "session",
      kind: "select-track",
      trackIndex: 5,
    });
    expect(
      interpretSessionViewControl(
        { kind: "step", step: 1 },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toBeNull();
  });

  test("affords Track Bank 2 targets only while Shift is held", () => {
    const control = createInitialControlSurfaceContext();

    expect(
      affordancesSessionView(
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual([]);

    control.setSurfaceControlHeld("shift", true);
    expect(
      affordancesSessionView(
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual([
      {
        trigger: { kind: "track-button", row: 0 },
        intent: { scope: "session", kind: "select-track", trackIndex: 4 },
      },
      {
        trigger: { kind: "track-button", row: 1 },
        intent: { scope: "session", kind: "select-track", trackIndex: 5 },
      },
      {
        trigger: { kind: "track-button", row: 2 },
        intent: { scope: "session", kind: "select-track", trackIndex: 6 },
      },
      {
        trigger: { kind: "track-button", row: 3 },
        intent: { scope: "session", kind: "select-track", trackIndex: 7 },
      },
    ]);
  });
});
