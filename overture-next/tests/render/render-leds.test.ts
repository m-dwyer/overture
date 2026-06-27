import { describe, expect, test } from "vitest";
import type { LedPort } from "../../src/ports/types";
import { renderLeds } from "../../src/render/render-leds";
import type { LedView } from "../../src/view/types";

describe("Overture Next LED rendering", () => {
  test("maps Session View Clip Cell pad states to central pad LEDs", () => {
    const calls: string[] = [];
    const leds = createLedRecorder(calls);
    const view: LedView = {
      steps: [],
      clipCellPads: [
        { padIndex: 7, state: "selected" },
        { padIndex: 24, state: "occupied" },
        { padIndex: 8, state: "empty" },
        { padIndex: 0, state: "off" },
      ],
      buttons: [
        { kind: "track-row", row: 0, state: "selected" },
        { kind: "track-row", row: 1, state: "hinted" },
        { kind: "track-row", row: 2, state: "available" },
      ],
    };

    renderLeds(view, leds);

    expect(calls).toEqual([
      "pad:7:120",
      "pad:24:48",
      "pad:8:4",
      "pad:0:0",
      "track-row:0:120",
      "track-row:1:44",
      "track-row:2:12",
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
