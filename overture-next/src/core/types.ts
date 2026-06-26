import type { CoreInput } from "./input";
import type { TrackState } from "./track";
import type { TransportState } from "./transport";
import type { OvertureView } from "../view/types";

export interface CoreState {
  activeTrack: number;
  sessionView: boolean;
  shiftHeld: boolean;
  selectedStep: number;
  transport: TransportState;
  tracks: TrackState[];
  lastInjectedStep: number;
}

export type HostCommand =
  | { kind: "track-note-on"; trackIndex: number; note: number; velocity: number }
  | { kind: "track-note-off"; trackIndex: number; note: number };

export interface OvertureCore {
  readonly state: CoreState;
  init(): void;
  tick(): void;
  applyInput(input: CoreInput): boolean;
  getView(): OvertureView;
  drainHostCommands(): HostCommand[];
}
