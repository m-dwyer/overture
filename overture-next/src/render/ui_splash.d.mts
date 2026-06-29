import type { SplashSurface } from "../ports/outbound";

export interface SplashRenderState {
  splashWasVisible: boolean;
  splashFrameTick: number;
}

export function renderSplashScreen(
  state: SplashRenderState,
  deps: SplashSurface,
): void;
