import { describe, expect, test } from "vitest";
import { createInitialControlSurfaceContext } from "../../src/state/control-surface-context";

describe("Overture Next Control Surface Context", () => {
  test("starts in Track View on the first Track and Clip Cell", () => {
    expect(createInitialControlSurfaceContext().snapshot()).toEqual({
      selectedTrackIndex: 0,
      visibleTrackBank: 0,
      activeView: "track",
      shiftHeld: false,
      selectedStep: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    });
  });

  test("keeps Track Selection, Selected Clip Cell, and Track Bank aligned", () => {
    const control = createInitialControlSurfaceContext();

    control.selectClipCell({ trackIndex: 6, sceneIndex: 3 });

    expect(control.snapshot()).toMatchObject({
      selectedTrackIndex: 6,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 6, sceneIndex: 3 },
    });
  });

  test("selects a Track while preserving the selected Overture Scene", () => {
    const control = createInitialControlSurfaceContext();

    control.selectClipCell({ trackIndex: 0, sceneIndex: 7 });
    control.selectTrackPreservingScene(5);

    expect(control.snapshot()).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 7 },
    });
  });

  test("updates modifiers, active view, and selected Step explicitly", () => {
    const control = createInitialControlSurfaceContext();

    control.setShiftHeld(true);
    expect(control.toggleActiveView()).toBe("session");
    control.selectStep(9);

    expect(control.snapshot()).toMatchObject({
      shiftHeld: true,
      activeView: "session",
      selectedStep: 9,
    });
  });

  test("rejects invalid selected Clip Cell and Step values", () => {
    const control = createInitialControlSurfaceContext();

    expect(() => control.selectClipCell({ trackIndex: 8, sceneIndex: 0 })).toThrow(
      "Invalid Track Index 8; expected integer from 0 to 7",
    );
    expect(() => control.selectStep(16)).toThrow("Invalid Step Index 16; expected integer from 0 to 15");
  });
});
