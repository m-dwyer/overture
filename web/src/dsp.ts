// Common DSP interface the host shims route to. Two implementations:
//   - mock-dsp.ts  (layout tier: just enough param state)
//   - wasm-dsp.ts  (behavior tier: the real seq8 engine compiled to wasm)
export interface Dsp {
  /** get_param: returns the value string, or null when absent (host semantics). */
  get(key: string): string | null;
  /** set_param. */
  set(key: string, val: string | number): void;
  /** Advance one audio block — crosses step boundaries + emits MIDI (no-op for mock). */
  render(): void;
  /** Set the engine BPM the DSP reads via host get_bpm (no-op for mock). */
  setBpm(bpm: number): void;
}
