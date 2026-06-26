import { renderSplashScreen } from "./ui_splash.mjs";
import type { OvertureHostAdapter, ScreenView } from "../core/types";

export function renderScreen(view: ScreenView, adapter: OvertureHostAdapter): void {
  if (view.kind === "splash") {
    renderSplashScreen({
      splashWasVisible: view.splashWasVisible,
      splashFrameTick: view.splashFrameTick,
    }, adapter.splashSurface);
    adapter.flush();
    return;
  }

  adapter.clear();
  adapter.print(0, 0, view.title, 1);
  adapter.print(0, 10, view.playing ? "PLAY" : "STOP", 1);
  adapter.print(42, 10, "T" + (view.activeTrack + 1), 1);
  adapter.print(72, 10, view.mode === "session" ? "SESSION" : "TRACK", 1);
  adapter.print(0, 22, "Clean core spike", 1);
  for (const step of view.steps) {
    const x = 2 + step.index * 7;
    const h = step.active ? 7 : 3;
    const y = 54 - h;
    adapter.rect(x, y, 5, h, step.playhead ? 1 : step.active ? 1 : 0, step.active || step.playhead);
  }
  adapter.print(0, 56, "Step " + (view.selectedStep + 1), 1);
  adapter.flush();
}
