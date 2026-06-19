// Headless emulator core: installs the Schwung `shadow_ui` host shims (as globals)
// around pluggable sinks + a DSP, loads the REAL tool ui.js, and exposes a small
// drive surface (init/tick/renderBlocks/sendInternal). No DOM — the browser shell
// and the test harness are just different bindings of the same core.
import type { Dsp } from "../dsp.js";
import { type DisplaySink, type LedSink, type MidiSink, type FileStore, memFiles } from "./sinks.js";

export interface EmulatorOptions {
  dsp: Dsp;
  display: DisplaySink;
  leds: LedSink;
  /** Opt-in fidelity shims for device-host edge cases. Default keeps friendly host behavior. */
  strict?: boolean;
  midi?: MidiSink;
  files?: FileStore;
  slots?: Array<Record<string, unknown>>;
  log?: (msg: string) => void;
}

export interface Emulator {
  init(): void;
  tick(): void;
  /** Pump the engine n audio blocks (advances playback/automation). */
  renderBlocks(n: number): void;
  sendInternal(status: number, d1: number, d2: number): void;
  sendExternal(status: number, d1: number, d2: number): void;
  readonly dsp: Dsp;
}

export async function createEmulator(opts: EmulatorOptions): Promise<Emulator> {
  const { dsp, display, leds } = opts;
  const strict = opts.strict ?? false;
  const log = opts.log ?? (() => {});
  const files = opts.files ?? memFiles();
  const midi: MidiSink = opts.midi ?? { inject: () => {}, toChain: () => {} };
  const slots = opts.slots ?? [
    { channel: 5, name: "Slot1" },
    { channel: 6, name: "Slot2" },
    { channel: 7, name: "Slot3" },
    { channel: 8, name: "Slot4" },
  ];
  const chainParams = new Map<string, string>();
  chainParams.set("0:midi_fx1_module", "arp");
  chainParams.set("0:synth_module", "linein");
  chainParams.set("0:fx1_module", "freeverb");
  chainParams.set("0:fx2_module", "");
  const installedModules = [
    { id: "arp", name: "Arpeggiator", version: "0.3.0", component_type: "midi_fx" },
    { id: "chord", name: "Chord", version: "0.1.0", component_type: "midi_fx" },
    { id: "linein", name: "Line In", version: "0.2.0", component_type: "sound_generator" },
    { id: "test-synth", name: "Test Synth", version: "0.1.0", component_type: "sound_generator" },
    { id: "freeverb", name: "Freeverb", version: "0.1.1", component_type: "audio_fx" },
    { id: "delay", name: "Delay", version: "0.1.0", component_type: "audio_fx" },
  ];

  // Display (1-bit OLED) → sink.
  const clear_screen = (): void => display.clearScreen();
  const fill_rect = (x: number, y: number, w: number, h: number, v: number | boolean): void => display.fillRect(x, y, w, h, v);
  const draw_rect = (x: number, y: number, w: number, h: number, v: number | boolean): void => display.drawRect(x, y, w, h, v);
  const set_pixel = (x: number, y: number, v: number | boolean): void => display.setPixel(x, y, v);
  const print = (x: number, y: number, text: unknown, color = 1): void => display.print(x, y, String(text ?? ""), color);
  const text_width = (text: unknown): number => display.textWidth(String(text ?? ""));
  const host_flush_display = (): void => display.flush();

  // LEDs: setLED/setButtonLED are direct; the tool also drives them through the
  // shared input_filter, which emits here: [0x09,NoteOn,note,color]=pad/step LED,
  // [0x0b,CC,cc,color]=button LED. (ui.js routes real MIDI via inject/to_chain.)
  const setLED = (index: number, color: number): void => leds.setLED(index, color);
  const setButtonLED = (cc: number, color: number): void => leds.setButtonLED(cc, color);
  const clearAllLEDs = (): void => leds.clearAll();
  const move_midi_internal_send = (pkt: number[]): void => {
    const status = (pkt[1] ?? 0) & 0xf0, idx = pkt[2] ?? 0, color = pkt[3] ?? 0;
    if (status === 0x90) leds.setLED(idx, color);
    else if (status === 0xb0) leds.setButtonLED(idx, color);
  };

  // Params → DSP (keep host get_bpm in sync when the UI sets bpm).
  const host_module_get_param = (key: string): string | null => dsp.get(key);
  const pendingSetParams = new Map<string, string | number>();
  const applySetParam = (key: string, val: string | number): void => {
    if (key === "bpm") dsp.setBpm(Number(val));
    dsp.set(key, val);
  };
  const flushSetParams = (): void => {
    if (pendingSetParams.size === 0) return;
    for (const [key, val] of pendingSetParams) applySetParam(key, val);
    pendingSetParams.clear();
  };
  const host_module_set_param = (key: string, val: string | number): void => {
    if (strict) {
      pendingSetParams.set(key, val);
      return;
    }
    applySetParam(key, val);
  };

  // State persistence + MIDI out + co-run.
  const host_write_file = (path: string, data: string): number => files.write(path, data);
  const host_read_file = (path: string): string | null => files.read(path);
  const host_file_exists = (path: string): number => (files.exists(path) ? 1 : 0);
  const host_ensure_dir = (): number => 1;
  const host_remove_dir = (): number => 1;
  const move_midi_inject_to_move = (pkt: number[]): void => midi.inject(pkt);
  const shadow_send_midi_to_dsp = (...a: unknown[]): void => midi.toChain(a);
  let corunState: { target: number; id: number; keep_mask: number } | null = null;
  const shadow_corun_begin = (target: number, id: number, keepMask: number): void => {
    corunState = { target, id, keep_mask: keepMask };
    log("corun_begin " + JSON.stringify([target, id, keepMask]));
  };
  const shadow_corun_end = (): void => {
    corunState = null;
    log("corun_end");
  };
  const shadow_corun_state = (): { target: number; id: number; keep_mask: number } | null =>
    corunState ? { ...corunState } : null;
  const shadow_get_slots = (): Array<Record<string, unknown>> => slots;
  const shadow_get_param = (slot: number, key: string): string | null =>
    chainParams.get(`${slot | 0}:${key}`) ?? null;
  const shadow_set_param = (slot: number, key: string, val: string | number): boolean => {
    const s = slot | 0;
    const v = String(val ?? "");
    if (key === "midi_fx1:module") chainParams.set(`${s}:midi_fx1_module`, v);
    else if (key === "synth:module") chainParams.set(`${s}:synth_module`, v);
    else if (key === "fx1:module") chainParams.set(`${s}:fx1_module`, v);
    else if (key === "fx2:module") chainParams.set(`${s}:fx2_module`, v);
    chainParams.set(`${s}:${key}`, v);
    log("shadow_set_param " + JSON.stringify([s, key, v]));
    return true;
  };
  const host_list_modules = (): Array<Record<string, unknown>> => installedModules.map((m) => ({ ...m }));
  const shadow_get_ui_flags = (): Record<string, unknown> => ({});

  Object.assign(globalThis, {
    clear_screen, fill_rect, draw_rect, set_pixel, print, text_width, host_flush_display,
    setLED, setButtonLED, clearAllLEDs, move_midi_internal_send,
    host_module_get_param, host_module_set_param,
    host_write_file, host_read_file, host_file_exists, host_ensure_dir, host_remove_dir,
    move_midi_inject_to_move, shadow_send_midi_to_dsp,
    shadow_corun_begin, shadow_corun_end, shadow_corun_state, shadow_get_slots,
    shadow_get_param, shadow_set_param, host_list_modules, shadow_get_ui_flags,
  });

  // Load the REAL tool UI. The literal lets Vite's remap plugin (and vitest)
  // rewrite the on-device path → overture-ui/ui/ui.js; `as string` tells TS it's untyped
  // JS. Must stay an inline literal — a variable import can't be analyzed by Vite.
  await import("/data/UserData/schwung/modules/tools/overture/ui.js" as string);

  return {
    init() { globalThis.init?.(); },
    tick() {
      // Strict mode treats each tick as the harness's simulated audio-buffer
      // boundary. Writes queued before the tick become DSP truth at tick start;
      // writes emitted by tick() are coalesced together and closed at tick end so
      // the existing render-before-tick harness step observes post-tick truth.
      if (strict) flushSetParams();
      globalThis.tick?.();
      if (strict) flushSetParams();
    },
    renderBlocks(n: number) { for (let i = 0; i < n; i++) dsp.render(); },
    sendInternal(status, d1, d2) { globalThis.onMidiMessageInternal?.([status, d1, d2]); },
    sendExternal(status, d1, d2) { globalThis.onMidiMessageExternal?.([status, d1, d2]); },
    dsp,
  };
}
