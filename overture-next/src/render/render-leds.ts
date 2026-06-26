import type { LedPort } from "../ports/types";
import type { LedView } from "../view/types";

export function renderLeds(view: LedView, leds: LedPort): void {
  for (const step of view.steps) {
    leds.setStepLed(step.step, step.color);
  }
  for (const button of view.buttons) {
    if (button.kind === "track-row") leds.setTrackRowLed(button.row, button.color);
    else if (button.kind === "play") leds.setPlayLed(button.color);
    else leds.setMenuLed(button.color);
  }
}
