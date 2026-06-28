import { describe, expect, test } from "vitest";
import { OVERTURE_LED_COLOR, OVERTURE_LED_COLOR_VALUES } from "../../overture-next/src/ports/led-colors";
import { hasStaticLedPaletteEntry, ledColor, setLedPaletteEntryRGB } from "../src/led-palette.js";

describe("browser LED palette", () => {
  test("has intentional CSS mappings for every Overture-emitted LED color", () => {
    expect(OVERTURE_LED_COLOR_VALUES.filter((color) => !hasStaticLedPaletteEntry(color))).toEqual([]);
    expect(ledColor(OVERTURE_LED_COLOR.hint)).toBe("#ffd84d");
    expect(ledColor(OVERTURE_LED_COLOR.hint)).not.toBe(ledColor(OVERTURE_LED_COLOR.dim));
    expect(ledColor(OVERTURE_LED_COLOR.hint)).not.toBe(ledColor(OVERTURE_LED_COLOR.active));
    expect(ledColor(OVERTURE_LED_COLOR.hint)).not.toBe(ledColor(OVERTURE_LED_COLOR.selected));
  });

  test("keeps tuned named colors when firmware palette SysEx is replayed", () => {
    const tunedDarkGrey = ledColor(124);

    setLedPaletteEntryRGB(124, 20, 20, 20);

    expect(ledColor(124)).toBe(tunedDarkGrey);
  });

  test("allows runtime scratch palette entries", () => {
    setLedPaletteEntryRGB(60, 32, 32, 32);

    expect(ledColor(60)).toBe("#202020");
  });
});
