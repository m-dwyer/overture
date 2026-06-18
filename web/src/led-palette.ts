// Move LED palette (index → CSS color). The exact 128-entry RGB table lives in
// Move firmware and is not in the repo — UX.md flags it "unconfirmed". This is an
// APPROXIMATION built from the named indices in schwung shared/constants.mjs
// (the tool's own source of truth), good enough to see which pads/steps/buttons
// light and roughly what colour. Replace with a device-captured palette later.

// Tuned for documentation screenshots: bright enough to read on a dark emulator
// chassis, but still grouped by the firmware palette indices Overture emits.
const NAMED: Record<number, string> = {
  0: "", // Off — caller reverts to the element's unlit background
  3: "#f4f4f5",   // Bright
  7: "#ffd84d",   // VividYellow
  8: "#63ef8a",   // BrightGreen
  14: "#55f0e8",  // Cyan
  16: "#6f8dff",  // RoyalBlue
  21: "#ff70d8",  // HotMagenta
  25: "#ff7fad",  // BrightPink
  28: "#ffad63",  // BurntOrange
  29: "#f0c341",  // Mustard
  32: "#4bc06f",  // DeepGreen
  36: "#d9dde2",  // LED_STEP_ACTIVE
  47: "#72c7ff",  // SkyBlue
  49: "#555e69",  // beat-marker grey
  50: "#7c8490",  // OOB grey
  65: "#ff6262",  // DeepRed
  66: "#8c3030",  // VeryDarkRed
  78: "#9a9638",  // DarkOlive
  86: "#3d8d52",  // dim forest
  93: "#5266d8",  // DeepBlue
  95: "#5570d8",  // DarkBlue
  96: "#354684",  // dim navy
  101: "#9a7cff", // PurpleBlue
  109: "#c454a5", // DeepMagenta
  114: "#a74768", // DeepWine
  118: "#d5d9de", // LightGrey
  120: "#ffffff", // White
  124: "#e3e7ec", // "DarkGrey" reads bright through translucent pads
  125: "#6691ff", // Blue
  126: "#4ee07a", // Green
  127: "#ff5f5f", // Red
};

/** CSS color for a Move palette index, or "" for off/unlit. */
export function ledColor(index: number): string {
  if (index in NAMED) return NAMED[index];
  // Unknown index (incl. runtime setPaletteEntryRGB scratch entries 51–61):
  // show as a neutral "lit" grey so the LED is still visible.
  return index > 0 ? "#9aa3ad" : "";
}
