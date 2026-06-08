// The shell collects its lit elements (pads, steps, button LEDs) into ref maps so
// the host's setLED/setButtonLED can paint them imperatively — LED colour never
// goes through React state (the playhead repaints ~94 Hz). Leaf controls register
// themselves via ledRef(); Shell builds the ShellLeds controller from the same maps.
import { createContext, useContext } from "react";

export interface LedRegistry {
  steps: Map<number, HTMLElement>; // key = LED index 16..31
  pads: Map<number, HTMLElement>; // key = note 68..99
  buttons: Map<number, HTMLElement>; // key = CC
}

const Ctx = createContext<LedRegistry | null>(null);

export const LedRegistryProvider = Ctx.Provider;

export function useLedRegistry(): LedRegistry {
  const reg = useContext(Ctx);
  if (!reg) throw new Error("useLedRegistry must be used within a LedRegistryProvider");
  return reg;
}

/** A callback ref that registers/unregisters an element under `key` in `map`. */
export function ledRef(map: Map<number, HTMLElement>, key: number) {
  return (el: HTMLElement | null) => {
    if (el) map.set(key, el);
    else map.delete(key);
  };
}
