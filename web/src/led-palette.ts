// Move LED palette (index → CSS color). The exact 128-entry RGB table lives in
// Move firmware and is not in the repo — UX.md flags it "unconfirmed". This is an
// APPROXIMATION built from the named indices in schwung shared/constants.mjs
// (the tool's own source of truth), good enough to see which pads/steps/buttons
// light and roughly what colour. Replace with a device-captured palette later.

const NAMED: Record<number, string> = {
  0: "", // Off — caller reverts to the element's unlit background
  3: "#ffffff",   // Bright
  7: "#ffe000",   // VividYellow
  8: "#30ff50",   // BrightGreen
  14: "#00e0e0",  // Cyan
  16: "#2840e0",  // RoyalBlue
  21: "#ff20c0",  // HotMagenta
  25: "#ff4d94",  // BrightPink
  28: "#c85a10",  // BurntOrange
  29: "#c8960a",  // Mustard
  32: "#0c7a34",  // DeepGreen
  36: "#606060",  // LED_STEP_ACTIVE (dim white)
  47: "#40b0ff",  // SkyBlue
  49: "#1a1a1a",  // beat-marker grey (~10% white)
  50: "#2a2a2a",  // OOB grey (~50% white)
  65: "#800000",  // DeepRed
  66: "#1a0404",  // VeryDarkRed
  78: "#3a3a12",  // DarkOlive
  86: "#0d2a12",  // dim forest (track-3/7 dim)
  93: "#101e70",  // DeepBlue
  95: "#1430a0",  // DarkBlue
  96: "#0a1030",  // dim navy (track-5 dim)
  101: "#5030c0", // PurpleBlue
  109: "#500a40", // DeepMagenta
  114: "#3a0a1a", // DeepWine
  118: "#aaaaaa", // LightGrey
  120: "#ffffff", // White
  124: "#555555", // DarkGrey
  125: "#2860ff", // Blue
  126: "#00d000", // Green
  127: "#ff2020", // Red
};

/** CSS color for a Move palette index, or "" for off/unlit. */
export function ledColor(index: number): string {
  if (index in NAMED) return NAMED[index];
  // Unknown index (incl. runtime setPaletteEntryRGB scratch entries 51–61):
  // show as a neutral "lit" grey so the LED is still visible.
  return index > 0 ? "#666666" : "";
}
