export interface StepView {
  index: number;
  active: boolean;
  selected: boolean;
  playhead: boolean;
}

export interface TrackScreenView {
  kind: "track";
  title: string;
  selectedTrackIndex: number;
  playing: boolean;
  selectedStep: number;
  steps: StepView[];
}

export interface SessionScreenView {
  kind: "session";
  title: string;
  selectedTrackIndex: number;
  selectedSceneIndex: number;
  selectedClipId: string | null;
  playing: boolean;
}

export type ScreenView = TrackScreenView | SessionScreenView;

export interface StepLedView {
  step: number;
  color: number;
}

export interface ClipCellPadLedView {
  padIndex: number;
  state: "selected" | "occupied" | "empty" | "off";
}

export type ButtonLedView =
  | { kind: "track-row"; row: number; state: "selected" | "hinted" | "available" }
  | { kind: "play"; color: number }
  | { kind: "menu"; color: number };

export interface LedView {
  steps: StepLedView[];
  clipCellPads: ClipCellPadLedView[];
  buttons: ButtonLedView[];
}

export interface OvertureView {
  screen: ScreenView;
  leds: LedView;
}
