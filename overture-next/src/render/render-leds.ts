import type { LedPort } from "../ports/outbound";
import { OVERTURE_LED_COLOR, TRACK_COLOR_BYTES } from "../ports/led-colors";
import { assertNever } from "../shared/assert-never";
import type { LedView, PadLedView } from "../view";

const STEP_COLORS = {
  playhead: OVERTURE_LED_COLOR.selected,
  active: OVERTURE_LED_COLOR.active,
  off: OVERTURE_LED_COLOR.off,
} as const;

const PAD_COLORS = {
  pressed: OVERTURE_LED_COLOR.selected,
  playing: OVERTURE_LED_COLOR.playing,
  queued: OVERTURE_LED_COLOR.hint,
  "queued-stop": OVERTURE_LED_COLOR.available,
  selected: OVERTURE_LED_COLOR.selected,
  hinted: OVERTURE_LED_COLOR.hint,
  occupied: OVERTURE_LED_COLOR.active,
  playable: OVERTURE_LED_COLOR.dim,
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

/**
 * A pad lights in its Track Colour when a colour is present (the playable
 * baseline); coloured highlights replace it with a fixed state colour for now.
 */
function padColor(pad: PadLedView): number {
  if (pad.colour !== undefined)
    return TRACK_COLOR_BYTES[pad.colour] ?? PAD_COLORS.playable;
  return PAD_COLORS[pad.state];
}

/**
 * A track-row (side) button lights in its Track Colour whether selected or not,
 * so a Track stays identifiable; only a hinted button takes a highlight
 * treatment. (Distinguishing the selected Track by brightness awaits modulation.)
 */
function trackRowColor(button: {
  state: "selected" | "hinted" | "available";
  colour?: number;
}): number {
  if (button.state !== "hinted" && button.colour !== undefined)
    return TRACK_COLOR_BYTES[button.colour] ?? TRACK_ROW_COLORS[button.state];
  return TRACK_ROW_COLORS[button.state];
}

export function renderLeds(view: LedView, leds: LedPort): void {
  for (const step of view.steps) {
    leds.setStepLed(step.step, STEP_COLORS[step.state]);
  }
  for (const pad of view.pads) {
    leds.setPadLed(pad.padIndex, padColor(pad));
  }
  for (const button of view.buttons) {
    switch (button.kind) {
      case "track-row":
        leds.setTrackRowLed(button.row, trackRowColor(button));
        break;
      case "play":
        leds.setPlayLed(PLAY_BUTTON_COLORS[button.state]);
        break;
      case "menu":
        leds.setMenuLed(MENU_BUTTON_COLORS[button.state]);
        break;
      default:
        assertNever(button);
    }
  }
}
