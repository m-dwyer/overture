import type { CoreInput } from "./input";
import type { TrackState } from "./track";
import type { TransportState } from "./transport";

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

export interface StepView {
  index: number;
  active: boolean;
  selected: boolean;
  playhead: boolean;
}

export interface TrackScreenView {
  kind: "track";
  title: string;
  mode: "track" | "session";
  activeTrack: number;
  playing: boolean;
  selectedStep: number;
  steps: StepView[];
}

export type ScreenView = TrackScreenView;

export interface StepLedView {
  step: number;
  color: number;
}

export type ButtonLedView =
  | { kind: "track-row"; row: number; color: number }
  | { kind: "play"; color: number }
  | { kind: "menu"; color: number };

export interface LedView {
  steps: StepLedView[];
  buttons: ButtonLedView[];
}

export interface OvertureView {
  screen: ScreenView;
  leds: LedView;
}

export type HostCommand =
  | { kind: "move-note-on"; track: number; note: number; velocity: number }
  | { kind: "move-note-off"; track: number; note: number };

export interface SplashSurface {
  clear(): void;
  fillRect(x: number, y: number, width: number, height: number, color: number): void;
}

export interface RuntimePort {
  publishState(state: CoreState): void;
}

export interface DisplayPort {
  splashSurface: SplashSurface;
  clear(): void;
  print(x: number, y: number, text: string, color: number): void;
  rect(x: number, y: number, width: number, height: number, color: number, fill: boolean): void;
  flush(): void;
}

export interface LedPort {
  setStepLed(step: number, color: number): void;
  setTrackRowLed(row: number, color: number): void;
  setPlayLed(color: number): void;
  setMenuLed(color: number): void;
}

export interface HostCommandPort {
  execute(command: HostCommand): void;
}

export interface OvertureCore {
  readonly state: CoreState;
  init(): void;
  tick(): void;
  applyInput(input: CoreInput): boolean;
  getView(): OvertureView;
  drainHostCommands(): HostCommand[];
}
