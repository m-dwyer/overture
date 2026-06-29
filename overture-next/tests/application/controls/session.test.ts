import { describe, expect, test } from "vitest";
import { createInitialControlSurfaceContext } from "../../../src/state/control-surface-context";
import { interpretSessionControl } from "../../../src/application/controls/session";

describe("Overture Next Session control interpretation", () => {
  test("interprets pad presses as visible-bank Clip Cell launches", () => {
    const control = createInitialControlSurfaceContext();
    control.selectTrackPreservingScene(4);

    const intent = interpretSessionControl({ kind: "pad", held: true, padIndex: 26, velocity: 100 }, control.snapshot());

    expect(intent).toEqual({ kind: "launch-clip-cell", coordinate: { trackIndex: 4, sceneIndex: 2 } });
    expect(intent).not.toHaveProperty("padIndex");
  });

  test("ignores pad releases", () => {
    const control = createInitialControlSurfaceContext();

    expect(
      interpretSessionControl({ kind: "pad", held: false, padIndex: 26, velocity: 0 }, control.snapshot()),
    ).toBeNull();
  });
});
