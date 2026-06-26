import type { ScreenView } from "../view/types";

export interface SplashScreenView {
  kind: "splash";
  splashWasVisible: boolean;
  splashFrameTick: number;
}

export type RenderableScreenView = ScreenView | SplashScreenView;
