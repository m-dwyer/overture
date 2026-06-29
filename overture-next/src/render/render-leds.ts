import type { LedPort } from "../ports/outbound";
import { OVERTURE_LED_COLOR } from "../ports/led-colors";
import type { LedView } from "../view";

const STEP_COLORS = {
  playhead: OVERTURE_LED_COLOR.selected,
  active: OVERTURE_LED_COLOR.active,
  off: OVERTURE_LED_COLOR.off,
} as const;

const PAD_COLORS = {
  selected: OVERTURE_LED_COLOR.selected,
  hinted: OVERTURE_LED_COLOR.hint,
  occupied: OVERTURE_LED_COLOR.active,
  empty: OVERTURE_LED_COLOR.dim,
  off: OVERTURE_LED_COLOR.off,
} as const;

const TRACK_ROW_COLORS = {
  selected: OVERTURE_LED_COLOR.selected,
  hinted: OVERTURE_LED_COLOR.hint,
  available: OVERTURE_LED_COLOR.available,
} as const;

const PLAY_BUTTON_COLORS = {
  playing: OVERTURE_LED_COLOR.playing,
  stopped: OVERTURE_LED_COLOR.dim,
} as const;

const MENU_BUTTON_COLORS = {
  session: OVERTURE_LED_COLOR.hint,
  track: OVERTURE_LED_COLOR.enabled,
} as const;

export function renderLeds(view: LedView, leds: LedPort): void {
  for (const step of view.steps) {
    leds.setStepLed(step.step, STEP_COLORS[step.state]);
  }
  for (const pad of view.pads) {
    leds.setPadLed(pad.padIndex, PAD_COLORS[pad.state]);
  }
  for (const button of view.buttons) {
    if (button.kind === "track-row")
      leds.setTrackRowLed(button.row, TRACK_ROW_COLORS[button.state]);
    else if (button.kind === "play")
      leds.setPlayLed(PLAY_BUTTON_COLORS[button.state]);
    else leds.setMenuLed(MENU_BUTTON_COLORS[button.state]);
  }
}
