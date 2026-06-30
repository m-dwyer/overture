import {
  clipCellCoordinate,
  type ClipCellCoordinate,
  type ClipCellCoordinateInput,
} from "../domain/project";
import { stepIndex, type StepIndex } from "../domain/sequence";
import { nonEmptyString, type Branded } from "../domain/value-objects";
import { trackBankForTrack } from "./surface-addressing";

export type ActiveView = "track" | "session";
export type HeldSurfaceControl = "shift";
export type RootViewPageId = Branded<string, "RootViewPageId">;
export type ParameterId = Branded<string, "ParameterId">;

export interface TrackViewControlContextSnapshot {
  readonly selectedPageId: RootViewPageId;
  readonly selectedParameterIdByPage: Readonly<
    Record<RootViewPageId, ParameterId>
  >;
}

export interface ControlSurfaceContextSnapshot {
  readonly selectedTrackIndex: number;
  readonly visibleTrackBank: number;
  readonly activeView: ActiveView;
  readonly heldControls: readonly HeldSurfaceControl[];
  readonly selectedStep: number;
  readonly selectedClipCell: Readonly<ClipCellCoordinate>;
  readonly heldPads: readonly number[];
  readonly trackView: TrackViewControlContextSnapshot;
}

export const DEFAULT_TRACK_VIEW_PAGE_ID = rootViewPageId("default");
export const TRACK_VIEW_SOUND_PAGE_ID = rootViewPageId("sound");
const DEFAULT_TRACK_VIEW_PARAMETER_ID = parameterId("default");

export class ControlSurfaceContext {
  private selectedTrackIndexValue: number;
  private visibleTrackBankValue: number;
  private activeViewValue: ActiveView;
  private readonly heldControlsValue: Set<HeldSurfaceControl>;
  private selectedStepValue: StepIndex;
  private selectedClipCellValue: ClipCellCoordinate;
  private readonly heldPadsValue: Set<number>;
  private selectedTrackViewPageIdValue: RootViewPageId;
  private readonly selectedTrackViewParameterIdByPageValue: Record<
    RootViewPageId,
    ParameterId
  >;

  constructor() {
    this.selectedTrackIndexValue = 0;
    this.visibleTrackBankValue = 0;
    this.activeViewValue = "session";
    this.heldControlsValue = new Set();
    this.selectedStepValue = stepIndex(0);
    this.selectedClipCellValue = clipCellCoordinate({
      trackIndex: 0,
      sceneIndex: 0,
    });
    this.heldPadsValue = new Set();
    this.selectedTrackViewPageIdValue = DEFAULT_TRACK_VIEW_PAGE_ID;
    this.selectedTrackViewParameterIdByPageValue = {
      [DEFAULT_TRACK_VIEW_PAGE_ID]: DEFAULT_TRACK_VIEW_PARAMETER_ID,
    };
  }

  snapshot(): ControlSurfaceContextSnapshot {
    return {
      selectedTrackIndex: this.selectedTrackIndexValue,
      visibleTrackBank: this.visibleTrackBankValue,
      activeView: this.activeViewValue,
      heldControls: [...this.heldControlsValue],
      selectedStep: this.selectedStepValue,
      selectedClipCell: { ...this.selectedClipCellValue },
      heldPads: [...this.heldPadsValue],
      trackView: {
        selectedPageId: this.selectedTrackViewPageIdValue,
        selectedParameterIdByPage: {
          ...this.selectedTrackViewParameterIdByPageValue,
        },
      },
    };
  }

  setSurfaceControlHeld(control: HeldSurfaceControl, held: boolean): void {
    if (held) this.heldControlsValue.add(control);
    else this.heldControlsValue.delete(control);
  }

  toggleActiveView(): ActiveView {
    this.activeViewValue =
      this.activeViewValue === "session" ? "track" : "session";
    return this.activeViewValue;
  }

  selectTrackPreservingScene(trackIndex: number): void {
    this.selectClipCell({
      trackIndex,
      sceneIndex: this.selectedClipCellValue.sceneIndex,
    });
  }

  selectClipCell(coordinateInput: ClipCellCoordinateInput): void {
    const coordinate = clipCellCoordinate(coordinateInput);
    this.selectedClipCellValue = { ...coordinate };
    this.selectedTrackIndexValue = coordinate.trackIndex;
    this.visibleTrackBankValue = trackBankForTrack(coordinate.trackIndex);
  }

  selectStep(stepIndexValue: number): void {
    this.selectedStepValue = stepIndex(stepIndexValue);
  }

  setPadHeld(padIndex: number, held: boolean): void {
    if (held) this.heldPadsValue.add(padIndex);
    else this.heldPadsValue.delete(padIndex);
  }

  selectTrackViewPage(pageIdValue: string): void {
    const pageId = rootViewPageId(pageIdValue);
    this.selectedTrackViewPageIdValue = pageId;
    if (!this.selectedTrackViewParameterIdByPageValue[pageId]) {
      this.selectedTrackViewParameterIdByPageValue[pageId] =
        DEFAULT_TRACK_VIEW_PARAMETER_ID;
    }
  }

  selectTrackViewPageParameter(parameterIdValue: string): void {
    this.selectedTrackViewParameterIdByPageValue[
      this.selectedTrackViewPageIdValue
    ] = parameterId(parameterIdValue);
  }
}

export function createInitialControlSurfaceContext(): ControlSurfaceContext {
  return new ControlSurfaceContext();
}

function rootViewPageId(value: string): RootViewPageId {
  return nonEmptyString("Root View Page ID", value) as RootViewPageId;
}

function parameterId(value: string): ParameterId {
  return nonEmptyString("Parameter ID", value) as ParameterId;
}
