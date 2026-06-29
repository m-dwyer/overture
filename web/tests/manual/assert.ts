import type { Probe, ShotExpect } from "./types";

// Compare a shot's declared expectation against the live emulator probe and
// return every mismatch (empty array = the figure depicts what its caption
// claims). Collecting ALL mismatches — rather than stopping at the first —
// makes a drift failure report the whole story in one go.
export function diffExpect(
  label: string,
  want: ShotExpect,
  got: Probe,
): string[] {
  const fails: string[] = [];
  const cmp = (name: string, expected: unknown, actual: unknown) => {
    if (expected !== undefined && expected !== actual) {
      fails.push(
        `${name}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`,
      );
    }
  };

  cmp("sessionView", want.sessionView, got.sessionView);
  cmp("activeTrack", want.activeTrack, got.activeTrack);
  cmp("activeBank", want.activeBank, got.activeBank);
  cmp("globalMenuOpen", want.globalMenuOpen, got.globalMenuOpen);
  cmp("menuLabel", want.menuLabel, got.menuLabel);

  if (want.recording !== undefined) {
    const recording = got.recordArmed || got.recordCountingIn;
    cmp("recording", want.recording, recording);
  }

  if (want.oledIncludes !== undefined) {
    const needles = Array.isArray(want.oledIncludes)
      ? want.oledIncludes
      : [want.oledIncludes];
    for (const needle of needles) {
      if (!got.oled.includes(needle)) {
        fails.push(
          `oledIncludes: "${needle}" not found in OLED ${JSON.stringify(got.oled)}`,
        );
      }
    }
  }

  return fails.map((f) => `[${label}] ${f}`);
}
