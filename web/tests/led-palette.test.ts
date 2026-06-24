import { describe, expect, test } from "vitest";
import { ledColor, setLedPaletteEntryRGB } from "../src/led-palette.js";

describe("browser LED palette", () => {
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
