import type { ScreenView } from "../core/types";

export interface SplashScreenView {
  kind: "splash";
  splashWasVisible: boolean;
  splashFrameTick: number;
}

export type RenderableScreenView = ScreenView | SplashScreenView;
