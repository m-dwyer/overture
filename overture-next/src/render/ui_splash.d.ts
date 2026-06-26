import type { CoreState, SplashSurface } from "../core/types";

export function renderSplashScreen(state: Pick<CoreState, "splashWasVisible" | "splashFrameTick">, deps: SplashSurface): void;
