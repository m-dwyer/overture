import type { HostCommand } from "../host-commands";
import type { ClipCellCoordinateInput } from "../../domain/project";
import type {
  HeldSurfaceControl,
  RootViewPageId,
} from "../../state/control-surface-context";

export type GlobalIntent =
  | {
      scope: "global";
      kind: "set-surface-control-held";
      control: HeldSurfaceControl;
      held: boolean;
    }
  | { scope: "global"; kind: "toggle-view" };

export type TransportIntent = {
  scope: "transport";
  kind: "toggle-transport-playback";
};

export type SessionIntent =
  | { scope: "session"; kind: "select-track"; trackIndex: number }
  | {
      scope: "session";
      kind: "select-clip-cell";
      coordinate: ClipCellCoordinateInput;
    }
  | {
      scope: "session";
      kind: "launch-clip-cell";
      coordinate: ClipCellCoordinateInput;
    };

export type TrackIntent =
  | { scope: "track"; kind: "select-track"; trackIndex: number }
  | { scope: "track"; kind: "select-track-view-page"; pageId: RootViewPageId }
  | { scope: "track"; kind: "toggle-step"; stepIndex: number }
  | {
      scope: "track";
      kind: "audition-note";
      held: boolean;
      padIndex: number;
      note: number;
      trackIndex: number;
      velocity: number;
    };

export type DomainIntent =
  GlobalIntent | TransportIntent | SessionIntent | TrackIntent;

export interface DomainIntentTransaction {
  applied: boolean;
  hostCommands: HostCommand[];
}
