import { describe, expect, test } from "vitest";
import {
  createInitialControlState,
  selectClipCell,
  selectStep,
  selectTrack,
  setShiftHeld,
  toggleControlMode,
} from "../../src/core/control-state";

describe("Overture Next Control State", () => {
  test("starts in Track View on the first Track and Clip Cell", () => {
    expect(createInitialControlState()).toEqual({
      selectedTrackIndex: 0,
      visibleTrackBank: 0,
      controlMode: "track",
      shiftHeld: false,
      selectedStep: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
    });
  });

  test("keeps Track Selection, Selected Clip Cell, and Track Bank aligned", () => {
    const control = createInitialControlState();

    selectClipCell(control, { trackIndex: 6, sceneIndex: 3 });

    expect(control.selectedTrackIndex).toBe(6);
    expect(control.visibleTrackBank).toBe(1);
    expect(control.selectedClipCell).toEqual({ trackIndex: 6, sceneIndex: 3 });
  });

  test("selects a Track while preserving the selected Overture Scene", () => {
    const control = createInitialControlState();

    selectClipCell(control, { trackIndex: 0, sceneIndex: 7 });
    selectTrack(control, 5);

    expect(control.selectedTrackIndex).toBe(5);
    expect(control.visibleTrackBank).toBe(1);
    expect(control.selectedClipCell).toEqual({ trackIndex: 5, sceneIndex: 7 });
  });

  test("updates modifiers, mode, and selected Step explicitly", () => {
    const control = createInitialControlState();

    setShiftHeld(control, true);
    expect(toggleControlMode(control)).toBe("session");
    selectStep(control, 9);

    expect(control.shiftHeld).toBe(true);
    expect(control.controlMode).toBe("session");
    expect(control.selectedStep).toBe(9);
  });
});
