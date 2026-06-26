import type { CoreInput } from "./input";
import type { TrackState } from "./track";
import type { TransportState } from "./transport";
import type { OvertureView } from "../view/types";

export interface CoreState {
  stateLoading: boolean;
  pendingSetLoad: boolean;
  pendingDspSync: number;
  ledInitComplete: boolean;
  activeTrack: number;
  sessionView: boolean;
  shiftHeld: boolean;
  selectedStep: number;
  transport: TransportState;
  tracks: TrackState[];
  lastInjectedStep: number;
  touchedParam: null;
}

export type HostCommand =
  | { kind: "move-note-on"; track: number; note: number; velocity: number }
  | { kind: "move-note-off"; track: number; note: number };

export interface OvertureCore {
  readonly state: CoreState;
  init(): void;
  tick(): void;
  applyInput(input: CoreInput): boolean;
  getView(): OvertureView;
  drainHostCommands(): HostCommand[];
}
