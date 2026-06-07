// Layout-tier mock DSP — just enough param state to let the real UI render and
// be navigated. NOT behaviourally accurate (no real sequencer/playback): that is
// the behaviour tier (real seq8-wasm). Flesh out keys here only as the UI needs
// them for layout/flow work; prefer moving to wasm over deepening this mock.
//
// Mirrors host semantics: get returns a string, or null when absent.

const EMPTY_STEPS = "0".repeat(256);

export interface MockDsp {
  get(key: string): string | null;
  set(key: string, val: string | number): void;
  readonly _store: Map<string, string>;
}

export function createMockDsp(): MockDsp {
  const store = new Map<string, string>();

  return {
    get(key) {
      const v = store.get(key);
      if (v !== undefined) return v;
      // Sensible defaults for the bulk readers the UI polls early.
      if (/_steps$/.test(key)) return EMPTY_STEPS; // 256-char clip bitmap
      if (/_notes$/.test(key)) return ""; // space-joined note list
      if (key === "state_uuid") return ""; // forces JS first-run/sync path
      return null; // unknown → null (host semantics)
    },
    set(key, val) {
      store.set(key, String(val));
    },
    _store: store,
  };
}
