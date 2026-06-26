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
