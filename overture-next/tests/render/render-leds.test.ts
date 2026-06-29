import { describe, expect, test } from "vitest";
import { OVERTURE_LED_COLOR } from "../../src/ports/led-colors";
import type { LedPort } from "../../src/ports/outbound";
import { renderLeds } from "../../src/render/render-leds";
import type { LedView } from "../../src/view";

describe("Overture Next LED rendering", () => {
  test("maps Session View Clip Cell pad states to central pad LEDs", () => {
    const calls: string[] = [];
    const leds = createLedRecorder(calls);
    const view: LedView = {
      steps: [
        { step: 0, state: "active" },
        { step: 1, state: "playhead" },
        { step: 2, state: "off" },
      ],
      pads: [
        { padIndex: 3, state: "playing" },
        { padIndex: 4, state: "queued" },
        { padIndex: 5, state: "queued-stop" },
        { padIndex: 7, state: "selected" },
        { padIndex: 15, state: "hinted" },
        { padIndex: 24, state: "occupied" },
        { padIndex: 8, state: "empty" },
        { padIndex: 0, state: "off" },
      ],
      buttons: [
        { kind: "track-row", row: 0, state: "selected" },
        { kind: "track-row", row: 1, state: "hinted" },
        { kind: "track-row", row: 2, state: "available" },
        { kind: "play", state: "playing" },
        { kind: "menu", state: "session" },
      ],
    };

    renderLeds(view, leds);

    expect(calls).toEqual([
      "step:0:" + OVERTURE_LED_COLOR.active,
      "step:1:" + OVERTURE_LED_COLOR.selected,
      "step:2:" + OVERTURE_LED_COLOR.off,
      "pad:3:" + OVERTURE_LED_COLOR.playing,
      "pad:4:" + OVERTURE_LED_COLOR.hint,
      "pad:5:" + OVERTURE_LED_COLOR.available,
      "pad:7:" + OVERTURE_LED_COLOR.selected,
      "pad:15:" + OVERTURE_LED_COLOR.hint,
      "pad:24:" + OVERTURE_LED_COLOR.active,
      "pad:8:" + OVERTURE_LED_COLOR.dim,
      "pad:0:" + OVERTURE_LED_COLOR.off,
      "track-row:0:" + OVERTURE_LED_COLOR.selected,
      "track-row:1:" + OVERTURE_LED_COLOR.hint,
      "track-row:2:" + OVERTURE_LED_COLOR.available,
      "play:" + OVERTURE_LED_COLOR.playing,
      "menu:" + OVERTURE_LED_COLOR.hint,
    ]);
  });
});

function createLedRecorder(calls: string[]): LedPort {
  return {
    setStepLed(step, color) {
      calls.push("step:" + step + ":" + color);
    },
    setPadLed(padIndex, color) {
      calls.push("pad:" + padIndex + ":" + color);
    },
    setTrackRowLed(row, color) {
      calls.push("track-row:" + row + ":" + color);
    },
    setPlayLed(color) {
      calls.push("play:" + color);
    },
    setMenuLed(color) {
      calls.push("menu:" + color);
    },
  };
}
