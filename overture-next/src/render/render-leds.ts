import type { LedPort } from "../ports/types";
import type { LedView } from "../view/types";

const CLIP_CELL_PAD_COLORS = {
  selected: 120,
  occupied: 48,
  empty: 4,
  off: 0,
} as const;

export function renderLeds(view: LedView, leds: LedPort): void {
  for (const step of view.steps) {
    leds.setStepLed(step.step, step.color);
  }
  for (const pad of view.clipCellPads) {
    leds.setPadLed(pad.padIndex, CLIP_CELL_PAD_COLORS[pad.state]);
  }
  for (const button of view.buttons) {
    if (button.kind === "track-row") leds.setTrackRowLed(button.row, button.color);
    else if (button.kind === "play") leds.setPlayLed(button.color);
    else leds.setMenuLed(button.color);
  }
}
