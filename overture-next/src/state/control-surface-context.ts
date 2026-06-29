import type { ClipCellCoordinate } from "../domain/project";
import { trackBankForTrack } from "./surface-addressing";

export type ActiveView = "track" | "session";

export interface ControlSurfaceContextSnapshot {
  readonly selectedTrackIndex: number;
  readonly visibleTrackBank: number;
  readonly activeView: ActiveView;
  readonly shiftHeld: boolean;
  readonly selectedStep: number;
  readonly selectedClipCell: Readonly<ClipCellCoordinate>;
}

export class ControlSurfaceContext {
  private selectedTrackIndexValue: number;
  private visibleTrackBankValue: number;
  private activeViewValue: ActiveView;
  private shiftHeldValue: boolean;
  private selectedStepValue: number;
  private selectedClipCellValue: ClipCellCoordinate;

  constructor() {
    this.selectedTrackIndexValue = 0;
    this.visibleTrackBankValue = 0;
    this.activeViewValue = "track";
    this.shiftHeldValue = false;
    this.selectedStepValue = 0;
    this.selectedClipCellValue = { trackIndex: 0, sceneIndex: 0 };
  }

  snapshot(): ControlSurfaceContextSnapshot {
    return {
      selectedTrackIndex: this.selectedTrackIndexValue,
      visibleTrackBank: this.visibleTrackBankValue,
      activeView: this.activeViewValue,
      shiftHeld: this.shiftHeldValue,
      selectedStep: this.selectedStepValue,
      selectedClipCell: { ...this.selectedClipCellValue },
    };
  }

  setShiftHeld(held: boolean): void {
    this.shiftHeldValue = held;
  }

  toggleActiveView(): ActiveView {
    this.activeViewValue = this.activeViewValue === "session" ? "track" : "session";
    return this.activeViewValue;
  }

  selectTrackPreservingScene(trackIndex: number): void {
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

export function createInitialControlSurfaceContext(): ControlSurfaceContext {
  return new ControlSurfaceContext();
}
