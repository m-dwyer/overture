export interface BrowserSchwungDiagnosticEvent {
  detail: BrowserSchwungDiagnostics;
}

export interface BrowserSchwungDiagnostics {
  errors: Array<{ message: string; slotId: string }>;
  hostVolume: number;
  midi: Array<{ d1: number; d2: number; direction: string; slot: number; status: number }>;
  params: Array<{ key: string; slot: number; value: string }>;
  slots: Array<{
    channel: number;
    fx1: string;
    fx2: string;
    midiFx: string;
    name: string;
    synth: string;
  }>;
  worklet: Record<string, string>;
}

export class BrowserSchwungDiagnosticsStore {
  #errors: BrowserSchwungDiagnostics["errors"] = [];
  #midi: BrowserSchwungDiagnostics["midi"] = [];
  #params: BrowserSchwungDiagnostics["params"] = [];
  #worklet: Record<string, string> = {};

  recordError(slotId: string, message: string): void {
    this.#errors.push({ message, slotId });
    this.#errors = this.#errors.slice(-8);
  }

  recordMidi(slot: number, status: number, d1: number, d2: number, direction: string): void {
    this.#midi.push({ d1, d2, direction, slot, status });
    this.#midi = this.#midi.slice(-16);
  }

  recordParam(slot: number, key: string, value: string): void {
    this.#params.push({ key, slot, value });
    this.#params = this.#params.slice(-16);
  }

  setWorklet(slotId: string, mode: string): void {
    this.#worklet[slotId] = mode;
  }

  snapshot({
    hostVolume,
    slots,
  }: {
    hostVolume: number;
    slots: BrowserSchwungDiagnostics["slots"];
  }): BrowserSchwungDiagnostics {
    return {
      errors: this.#errors.slice(-8),
      hostVolume,
      midi: this.#midi.slice(-16),
      params: this.#params.slice(-16),
      slots,
      worklet: { ...this.#worklet },
    };
  }
}
