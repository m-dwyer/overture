import type { ClipCellCoordinate } from "../domain/project";
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

export interface HeldPadSnapshot {
  readonly padIndex: number;
  readonly velocity: number;
}

export interface ControlSurfaceContextSnapshot {
  readonly selectedTrackIndex: number;
  readonly visibleTrackBank: number;
  readonly activeView: ActiveView;
  readonly heldControls: readonly HeldSurfaceControl[];
  readonly selectedClipCell: Readonly<ClipCellCoordinate>;
  readonly heldPads: readonly HeldPadSnapshot[];
  readonly trackView: TrackViewControlContextSnapshot;
}

export const DEFAULT_TRACK_VIEW_PAGE_ID = rootViewPageId("default");
export const TRACK_VIEW_SOUND_PAGE_ID = rootViewPageId("sound");
const DEFAULT_TRACK_VIEW_PARAMETER_ID = parameterId("default");

export class ControlSurfaceContext {
  private activeViewValue: ActiveView;
  private readonly heldControlsValue: Set<HeldSurfaceControl>;
  private readonly heldPadsValue: Map<number, number>;
  private selectedTrackViewPageIdValue: RootViewPageId;
  private readonly selectedTrackViewParameterIdByPageValue: Record<
    RootViewPageId,
    ParameterId
  >;

  constructor() {
    this.activeViewValue = "session";
    this.heldControlsValue = new Set();
    this.heldPadsValue = new Map();
    this.selectedTrackViewPageIdValue = DEFAULT_TRACK_VIEW_PAGE_ID;
    this.selectedTrackViewParameterIdByPageValue = {
      [DEFAULT_TRACK_VIEW_PAGE_ID]: DEFAULT_TRACK_VIEW_PARAMETER_ID,
    };
  }

  /**
   * Projects the Control Surface Context view for the given active cursor. The
   * cursor (Selected Clip Cell) is owned by OvertureProject and passed in; the
   * Track Selection and visible Track Bank are derived from it.
   */
  snapshot(
    selectedClipCell: ClipCellCoordinate,
  ): ControlSurfaceContextSnapshot {
    return {
      selectedTrackIndex: selectedClipCell.trackIndex,
      visibleTrackBank: trackBankForTrack(selectedClipCell.trackIndex),
      activeView: this.activeViewValue,
      heldControls: [...this.heldControlsValue],
      selectedClipCell: { ...selectedClipCell },
      heldPads: [...this.heldPadsValue].map(([padIndex, velocity]) => ({
        padIndex,
        velocity,
      })),
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

  pressPad(padIndex: number, velocity: number): void {
    this.heldPadsValue.set(padIndex, velocity);
  }

  releasePad(padIndex: number): void {
    this.heldPadsValue.delete(padIndex);
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
