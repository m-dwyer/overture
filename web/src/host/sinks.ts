// Pluggable output sinks for the emulator core. The browser binds these to the
// canvas + shell; tests bind them to recorders. This is what lets the same real
// tool + engine run headless (Node) or in a browser.

export interface DisplaySink {
  clearScreen(): void;
  fillRect(
    x: number,
    y: number,
    w: number,
    h: number,
    value: number | boolean,
  ): void;
  drawRect(
    x: number,
    y: number,
    w: number,
    h: number,
    value: number | boolean,
  ): void;
  setPixel(x: number, y: number, value: number | boolean): void;
  print(x: number, y: number, text: string, color: number): void;
  textWidth(text: string): number;
  flush(): void;
}

export interface LedSink {
  setLED(index: number, color: number): void;
  setButtonLED(cc: number, color: number): void;
  setPaletteEntryRGB?(index: number, r: number, g: number, b: number): void;
  clearAll(): void;
}

export interface MidiSink {
  inject(pkt: number[]): void; // move_midi_inject_to_move (cable-routed to Move)
  toChain(args: unknown[]): void; // shadow_send_midi_to_dsp
}

export interface FileStore {
  read(path: string): string | null;
  write(path: string, data: string): number;
  exists(path: string): boolean;
}

/** Default in-memory FileStore (state persistence for headless runs). */
export function memFiles(): FileStore {
  const m = new Map<string, string>();
  return {
    read: (p) => (m.has(p) ? (m.get(p) as string) : null),
    write: (p, d) => {
      m.set(p, String(d));
      return 1;
    },
    exists: (p) => m.has(p),
  };
}
