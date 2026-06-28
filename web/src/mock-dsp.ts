// Mock DSP — just enough param state to let the real UI render and be navigated.
// Keep it shallow; behavior that belongs to Overture should live in overture-next.
//
// Mirrors host semantics: get returns a string, or null when absent.

import type { Dsp } from "./dsp.js";

const EMPTY_STEPS = "0".repeat(256);

export function createMockDsp(): Dsp {
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
    render() { /* layout tier: no engine */ },
    setBpm() { /* layout tier: no engine */ },
  };
}
