import type { SplashSurface } from "../core/types";

export interface SplashRenderState {
  splashWasVisible: boolean;
  splashFrameTick: number;
}

export function renderSplashScreen(state: SplashRenderState, deps: SplashSurface): void;
