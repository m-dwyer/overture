// The LED sink: records every LED/button color the tool sets into maps (so the OVT
// handle and a late-mounting shell can read/replay them) and forwards live to the
// shell's imperative LED controller once it exists. Pulled out of App.tsx — plain
// logic, no React. `getShell` returns the live controller (null until the shell
// mounts), so forwarding no-ops cleanly during early boot.
import { setLedPaletteEntryRGB } from "../led-palette";
import type { LedSink } from "./sinks";

export interface ShellLedSinkDeps {
  ledsMap: Map<number, number>;
  buttonLedsMap: Map<number, number>;
  getShell: () => LedSink | null;
}

export function createShellLedSink({ ledsMap, buttonLedsMap, getShell }: ShellLedSinkDeps): LedSink {
  return {
    setLED(i, c) {
      ledsMap.set(i, c);
      getShell()?.setLED(i, c);
    },
    setButtonLED(cc, c) {
      buttonLedsMap.set(cc, c);
      getShell()?.setButtonLED(cc, c);
    },
    setPaletteEntryRGB(index, r, g, b) {
      setLedPaletteEntryRGB(index, r, g, b);
      const shell = getShell();
      for (const [i, c] of ledsMap) if (c === index) shell?.setLED(i, c);
      for (const [cc, c] of buttonLedsMap) if (c === index) shell?.setButtonLED(cc, c);
    },
    clearAll() {
      ledsMap.clear();
      buttonLedsMap.clear();
      getShell()?.clearAll();
    },
  };
}
