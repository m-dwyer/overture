import type { CoreInput } from "./input";
import type { OvertureProject } from "./project";
import type { TransportState } from "./transport";
import type { OvertureView } from "../view/types";

export interface CoreState {
  selectedTrackIndex: number;
  visibleTrackBank: number;
  sessionView: boolean;
  shiftHeld: boolean;
  selectedStep: number;
  transport: TransportState;
  project: OvertureProject;
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
  getSelectedSequenceLength(): number;
  drainHostCommands(): HostCommand[];
}
