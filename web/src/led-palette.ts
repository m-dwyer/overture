// Move LED palette (index → CSS color). The exact 128-entry RGB table lives in
// Move firmware and is not in the repo — UX.md flags it "unconfirmed". This is an
// APPROXIMATION built from the named indices in schwung shared/constants.mjs
// (the tool's own source of truth), good enough to see which pads/steps/buttons
// light and roughly what colour. Replace with a device-captured palette later.

// Tuned for a tasteful neon-on-dark look (softer/less saturated than raw firmware
// values) so lit pads and backlit buttons read nicely against the dark chassis.
const NAMED: Record<number, string> = {
  0: "", // Off — caller reverts to the element's unlit background
  3: "#f4f4f5",   // Bright
  7: "#ffd23a",   // VividYellow (warm)
  8: "#5be37a",   // BrightGreen
  14: "#3fe0d8",  // Cyan
  16: "#5a7bff",  // RoyalBlue (softer indigo)
  21: "#ff5ec4",  // HotMagenta
  25: "#ff6fa3",  // BrightPink
  28: "#ff9a4d",  // BurntOrange
  29: "#e0b020",  // Mustard
  32: "#2f8f4e",  // DeepGreen
  36: "#8a8d86",  // LED_STEP_ACTIVE (warm dim white)
  47: "#5ab8ff",  // SkyBlue
  49: "#202220",  // beat-marker grey (~10% white)
  50: "#34362f",  // OOB grey (~50% white)
  65: "#a83838",  // DeepRed
  66: "#2a0e0e",  // VeryDarkRed
  78: "#4a4a1e",  // DarkOlive
  86: "#173a1f",  // dim forest (track-3/7 dim)
  93: "#26307a",  // DeepBlue
  95: "#33489c",  // DarkBlue
  96: "#161c3a",  // dim navy (track-5 dim)
  101: "#7a5cf0", // PurpleBlue
  109: "#6a1a55", // DeepMagenta
  114: "#4a1426", // DeepWine
  118: "#c2c2c2", // LightGrey
  120: "#ffffff", // White
  124: "#5c5c5c", // DarkGrey
  125: "#4f7bff", // Blue
  126: "#37d06a", // Green
  127: "#ff4d4d", // Red (softer)
};

/** CSS color for a Move palette index, or "" for off/unlit. */
export function ledColor(index: number): string {
  if (index in NAMED) return NAMED[index];
  // Unknown index (incl. runtime setPaletteEntryRGB scratch entries 51–61):
  // show as a neutral "lit" grey so the LED is still visible.
  return index > 0 ? "#6b6b6b" : "";
}
