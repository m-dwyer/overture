import { renderSplashScreen } from "./ui_splash.mjs";
import type { DisplayPort } from "../ports/types";
import type { RenderableScreenView } from "./types";

export function renderScreen(view: RenderableScreenView, display: DisplayPort): void {
  if (view.kind === "splash") {
    renderSplashScreen({
      splashWasVisible: view.splashWasVisible,
      splashFrameTick: view.splashFrameTick,
    }, display.splashSurface);
    display.flush();
    return;
  }

  display.clear();
  display.print(0, 0, view.title, 1);
  display.print(0, 10, view.playing ? "PLAY" : "STOP", 1);
  display.print(42, 10, "T" + (view.activeTrack + 1), 1);
  display.print(72, 10, view.mode === "session" ? "SESSION" : "TRACK", 1);
  display.print(0, 22, "Clean core spike", 1);
  for (const step of view.steps) {
    const x = 2 + step.index * 7;
    const h = step.active ? 7 : 3;
    const y = 54 - h;
    display.rect(x, y, 5, h, step.playhead ? 1 : step.active ? 1 : 0, step.active || step.playhead);
  }
  display.print(0, 56, "Step " + (view.selectedStep + 1), 1);
  display.flush();
}
