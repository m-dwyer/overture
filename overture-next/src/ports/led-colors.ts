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

export const OVERTURE_LED_COLOR_VALUES = [
  OVERTURE_LED_COLOR.off,
  OVERTURE_LED_COLOR.dim,
  OVERTURE_LED_COLOR.enabled,
  OVERTURE_LED_COLOR.available,
  OVERTURE_LED_COLOR.playing,
  OVERTURE_LED_COLOR.hint,
  OVERTURE_LED_COLOR.active,
  OVERTURE_LED_COLOR.selected,
] as const;
