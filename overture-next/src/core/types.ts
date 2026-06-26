import type { CoreInput } from "./input";
import type { TrackState } from "./track";
import type { TransportState } from "./transport";

export interface CoreState {
  bootSplashTicks: number;
  splashWasVisible: boolean;
  splashFrameTick: number;
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

export interface SplashScreenView {
  kind: "splash";
  splashWasVisible: boolean;
  splashFrameTick: number;
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

export type ScreenView = SplashScreenView | TrackScreenView;

export interface StepLedView {
  index: number;
  color: number;
}

export interface ButtonLedView {
  cc: number;
  color: number;
}

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
  clear_screen(): void;
  fill_rect(x: number, y: number, width: number, height: number, color: number): void;
}

export interface OvertureHostAdapter {
  splashSurface: SplashSurface;
  publishState(state: CoreState): void;
  execute(command: HostCommand): void;
  clear(): void;
  print(x: number, y: number, text: string, color: number): void;
  rect(x: number, y: number, width: number, height: number, color: number, fill: boolean): void;
  flush(): void;
  setLed(index: number, color: number): void;
  setButtonLed(cc: number, color: number): void;
  injectMoveNoteOn(track: number, note: number, velocity: number): void;
  injectMoveNoteOff(track: number, note: number): void;
}

export interface OvertureCore {
  readonly state: CoreState;
  init(): void;
  tick(): void;
  dispatchInput(data: readonly number[]): boolean;
  applyInput(input: CoreInput): boolean;
  getView(): OvertureView;
  drainHostCommands(): HostCommand[];
}
