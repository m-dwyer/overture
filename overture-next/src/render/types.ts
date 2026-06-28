import type { ScreenView } from "../view";

export interface SplashScreenView {
  kind: "splash";
  splashWasVisible: boolean;
  splashFrameTick: number;
}

export type RenderableScreenView = ScreenView | SplashScreenView;
