import type { LedView, OvertureHostAdapter } from "../core/types";

export function renderLeds(view: LedView, adapter: OvertureHostAdapter): void {
  for (const step of view.steps) {
    adapter.setLed(step.index, step.color);
  }
  for (const button of view.buttons) {
    adapter.setButtonLed(button.cc, button.color);
  }
}
