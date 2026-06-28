import type { ClipCellCoordinate } from "./project";
import { trackBankForTrack } from "./track";

export type ControlMode = "track" | "session";

export interface ControlStateSnapshot {
  readonly selectedTrackIndex: number;
  readonly visibleTrackBank: number;
  readonly controlMode: ControlMode;
  readonly shiftHeld: boolean;
  readonly selectedStep: number;
  readonly selectedClipCell: Readonly<ClipCellCoordinate>;
}

export class ControlState {
  private selectedTrackIndexValue: number;
  private visibleTrackBankValue: number;
  private controlModeValue: ControlMode;
  private shiftHeldValue: boolean;
  private selectedStepValue: number;
  private selectedClipCellValue: ClipCellCoordinate;

  constructor() {
    this.selectedTrackIndexValue = 0;
    this.visibleTrackBankValue = 0;
    this.controlModeValue = "track";
    this.shiftHeldValue = false;
    this.selectedStepValue = 0;
    this.selectedClipCellValue = { trackIndex: 0, sceneIndex: 0 };
  }

  snapshot(): ControlStateSnapshot {
    return {
      selectedTrackIndex: this.selectedTrackIndexValue,
      visibleTrackBank: this.visibleTrackBankValue,
      controlMode: this.controlModeValue,
      shiftHeld: this.shiftHeldValue,
      selectedStep: this.selectedStepValue,
      selectedClipCell: { ...this.selectedClipCellValue },
    };
  }

  setShiftHeld(held: boolean): void {
    this.shiftHeldValue = held;
  }

  toggleControlMode(): ControlMode {
    this.controlModeValue = this.controlModeValue === "session" ? "track" : "session";
    return this.controlModeValue;
  }

  selectTrack(trackIndex: number): void {
    this.selectClipCell({ trackIndex, sceneIndex: this.selectedClipCellValue.sceneIndex });
  }

  selectClipCell(coordinate: ClipCellCoordinate): void {
    this.selectedClipCellValue = { ...coordinate };
    this.selectedTrackIndexValue = coordinate.trackIndex;
    this.visibleTrackBankValue = trackBankForTrack(coordinate.trackIndex);
  }

  selectStep(stepIndex: number): void {
    this.selectedStepValue = stepIndex;
  }
}

export function createInitialControlState(): ControlState {
  return new ControlState();
}
