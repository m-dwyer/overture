import type { LedPort, LedView } from "../core/types";

export function renderLeds(view: LedView, leds: LedPort): void {
  for (const step of view.steps) {
    leds.setLed(step.index, step.color);
  }
  for (const button of view.buttons) {
    leds.setButtonLed(button.cc, button.color);
  }
}
