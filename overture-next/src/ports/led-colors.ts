export const OVERTURE_LED_COLOR = {
  off: 0,
  dim: 4,
  enabled: 8,
  available: 12,
  playing: 16,
  hint: 44,
  active: 48,
  selected: 120,
} as const;

/**
 * Track Colour LED bytes indexed by Track Colour identity. Eight distinct Move
 * palette hues, one per default Track. Render maps a Track Colour index to one
 * of these; the domain never holds an LED byte.
 */
export const TRACK_COLOR_BYTES = [
  127, // Red
  28, // Burnt Orange
  7, // Vivid Yellow
  8, // Bright Green
  14, // Cyan
  21, // Hot Magenta
  101, // Purple Blue
  25, // Bright Pink
] as const;

export const OVERTURE_LED_COLOR_VALUES = [
  OVERTURE_LED_COLOR.off,
  OVERTURE_LED_COLOR.dim,
  OVERTURE_LED_COLOR.enabled,
  OVERTURE_LED_COLOR.available,
  OVERTURE_LED_COLOR.playing,
  OVERTURE_LED_COLOR.hint,
  OVERTURE_LED_COLOR.active,
  OVERTURE_LED_COLOR.selected,
  ...TRACK_COLOR_BYTES,
] as const;
