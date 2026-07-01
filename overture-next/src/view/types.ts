export interface StepView {
  index: number;
  active: boolean;
  playhead: boolean;
}

export interface TrackScreenView {
  kind: "track";
  title: string;
  selectedTrackIndex: number;
  playing: boolean;
  trackPage: TrackScreenPageView;
  steps: StepView[];
}

export type TrackScreenPageView =
  | { kind: "sequence" }
  | {
      kind: "sound";
      route: "schwung";
      chainIndex: number;
      chainName: string;
      synthModuleId: string | null;
      synthModuleName: string | null;
      synthParameters: readonly string[];
    }
  | {
      kind: "sound";
      route: "move";
      moveTrackTarget: number;
    };

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

export interface SurfaceHint {
  surface: SurfaceRegion;
}

export interface StepLedView {
  step: number;
  state: "playhead" | "active" | "off";
}

export interface PadLedView {
  padIndex: number;
  /** Track Colour identity index; render maps it to an LED colour for coloured states. */
  colour?: number;
  state:
    | "pressed"
    | "playing"
    | "queued"
    | "queued-stop"
    | "selected"
    | "hinted"
    | "occupied"
    | "playable"
    | "empty"
    | "off";
}

export type ButtonLedView =
  | {
      kind: "track-row";
      row: number;
      /** Track Colour identity index; render lights the available baseline in it. */
      colour?: number;
      state: "selected" | "hinted" | "available";
    }
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
