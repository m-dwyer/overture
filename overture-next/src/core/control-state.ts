import type { ClipCellCoordinate } from "./project";
import { trackBankForTrack } from "./track";
import type { ControlMode, ControlState } from "./controls/types";

export function createInitialControlState(): ControlState {
  return {
    selectedTrackIndex: 0,
    visibleTrackBank: 0,
    controlMode: "track",
    shiftHeld: false,
    selectedStep: 0,
    selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
  };
}

export function setShiftHeld(control: ControlState, held: boolean): void {
  control.shiftHeld = held;
}

export function toggleControlMode(control: ControlState): ControlMode {
  control.controlMode = control.controlMode === "session" ? "track" : "session";
  return control.controlMode;
}

export function selectTrack(control: ControlState, trackIndex: number): void {
  selectClipCell(control, { trackIndex, sceneIndex: control.selectedClipCell.sceneIndex });
}

export function selectClipCell(control: ControlState, coordinate: ClipCellCoordinate): void {
  control.selectedClipCell = { ...coordinate };
  control.selectedTrackIndex = coordinate.trackIndex;
  control.visibleTrackBank = trackBankForTrack(coordinate.trackIndex);
}

export function selectStep(control: ControlState, stepIndex: number): void {
  control.selectedStep = stepIndex;
}
