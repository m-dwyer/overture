import { describe, expect, test } from "vitest";
import { ControlInputInterpreter } from "../../../src/application/controls/control-input-interpreter";
import { clipCellCoordinate } from "../../../src/domain/project";
import { createInitialControlSurfaceContext } from "../../../src/state/control-surface-context";

describe("Overture Next root control context interpretation", () => {
  const controlInputInterpreter = new ControlInputInterpreter();

  test("delegates non-global controls to the active root view context", () => {
    const control = createInitialControlSurfaceContext();
    const cursor = clipCellCoordinate({ trackIndex: 4, sceneIndex: 0 });

    expect(
      controlInputInterpreter.interpret(
        { kind: "pad", held: true, padIndex: 26, velocity: 100 },
        control.snapshot(cursor),
      ),
    ).toEqual({
      scope: "session",
      kind: "launch-clip-cell",
      coordinate: { trackIndex: 4, sceneIndex: 2 },
    });

    control.toggleActiveView();

    expect(
      controlInputInterpreter.interpret(
        { kind: "pad", held: true, padIndex: 7, velocity: 101 },
        control.snapshot(cursor),
      ),
    ).toEqual({
      scope: "track",
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

    expect(
      controlInputInterpreter.interpret(
        { kind: "menu" },
        control.snapshot(clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 })),
      ),
    ).toEqual({
      scope: "global",
      kind: "toggle-view",
    });
  });
});
