import { describe, expect, test } from "vitest";
import { createInitialControlState } from "../../src/core/control-state";

describe("Overture Next Control State", () => {
  test("starts in Track View on the first Track and Clip Cell", () => {
    expect(createInitialControlState().snapshot()).toEqual({
      selectedTrackIndex: 0,
      visibleTrackBank: 0,
      activeView: "track",
      shiftHeld: false,
      selectedStep: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    });
  });

  test("keeps Track Selection, Selected Clip Cell, and Track Bank aligned", () => {
    const control = createInitialControlState();

    control.selectClipCell({ trackIndex: 6, sceneIndex: 3 });

    expect(control.snapshot()).toMatchObject({
      selectedTrackIndex: 6,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 6, sceneIndex: 3 },
    });
  });

  test("selects a Track while preserving the selected Overture Scene", () => {
    const control = createInitialControlState();

    control.selectClipCell({ trackIndex: 0, sceneIndex: 7 });
    control.selectTrack(5);

    expect(control.snapshot()).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 7 },
    });
  });

  test("updates modifiers, mode, and selected Step explicitly", () => {
    const control = createInitialControlState();

    control.setShiftHeld(true);
    expect(control.toggleView()).toBe("session");
    control.selectStep(9);

    expect(control.snapshot()).toMatchObject({
      shiftHeld: true,
      activeView: "session",
      selectedStep: 9,
    });
  });
});
