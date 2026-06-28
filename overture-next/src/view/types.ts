import type { SurfaceHint } from "./surface-hints";

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
  state: "playhead" | "active" | "off";
}

export interface ClipCellPadLedView {
  padIndex: number;
  state: "selected" | "hinted" | "occupied" | "empty" | "off";
}

export type ButtonLedView =
  | { kind: "track-row"; row: number; state: "selected" | "hinted" | "available" }
  | { kind: "play"; state: "playing" | "stopped" }
  | { kind: "menu"; state: "session" | "track" };

export interface LedView {
  steps: StepLedView[];
  clipCellPads: ClipCellPadLedView[];
  buttons: ButtonLedView[];
}

export interface OvertureSurfaceView {
  surfaceHints: SurfaceHint[];
  screen: ScreenView;
  leds: LedView;
}
