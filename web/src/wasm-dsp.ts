// Behavior-tier DSP: the real seq8 engine compiled to wasm (overture-ui/dist/wasm/seq8).
// Boots the plugin, creates an instance, and exposes the flat ABI (see
// overture-ui/dsp/seq8_wasm_glue.c) as the common Dsp interface. MIDI the sequencer
// emits is forwarded to onMidi.
// "seq8-wasm" is a Vite alias → overture-ui/dist/wasm/seq8.mjs (a gitignored build
// artifact). The bare specifier keeps TS on the ambient declaration so a fresh
// checkout typechecks before the wasm is built. Run `mise run wasm` to produce it.
import Seq8Module from "seq8-wasm";
import type { Dsp } from "./dsp.js";

export type MidiOut = (tag: number, b0: number, b1: number, b2: number, b3: number) => void;

export async function createWasmDsp(onMidi?: MidiOut): Promise<Dsp> {
  const Module = await Seq8Module({
    onSeq8Midi: onMidi ?? (() => {}),
    onSeq8Log: () => {},
  });

  if (Module.ccall("seq8_boot", "number", [], []) !== 0) throw new Error("seq8_boot failed");
  const inst = Module.ccall("seq8_create", "number", ["string", "string"], ["", ""]);
  if (!inst) throw new Error("seq8_create returned null");

  const BUF = 65536;
  const buf = Module._malloc(BUF);

  return {
    get(key) {
      const n = Module.ccall("seq8_get_param", "number",
        ["number", "string", "number", "number"], [inst, key, buf, BUF]);
      return n >= 0 ? Module.UTF8ToString(buf, Math.min(n, BUF - 1)) : null;
    },
    set(key, val) {
      Module.ccall("seq8_set_param", "null", ["number", "string", "string"], [inst, key, String(val)]);
    },
    render() {
      Module.ccall("seq8_render", "null", ["number"], [inst]);
    },
    setBpm(bpm) {
      Module.ccall("seq8_set_bpm", "null", ["number"], [bpm]);
    },
  };
}
