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

export type SurfaceRegion =
  | { kind: "session-scene-column"; sceneIndex: number }
  | { kind: "track-row"; row: number };

export type SurfaceHint = { kind: "scene-launch-target"; surface: SurfaceRegion };

export interface StepLedView {
  step: number;
  state: "playhead" | "active" | "off";
}

export interface PadLedView {
  padIndex: number;
  state: "selected" | "hinted" | "occupied" | "empty" | "off";
}

export type ButtonLedView =
  | { kind: "track-row"; row: number; state: "selected" | "hinted" | "available" }
  | { kind: "play"; state: "playing" | "stopped" }
  | { kind: "menu"; state: "session" | "track" };

export interface LedView {
  steps: StepLedView[];
  pads: PadLedView[];
  buttons: ButtonLedView[];
}

export interface OvertureSurfaceView {
  surfaceHints: SurfaceHint[];
  screen: ScreenView;
  leds: LedView;
}
