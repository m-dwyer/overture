// Ambient types for the Schwung `shadow_ui` host contract the emulator mocks.
// The tool calls these as bare globals (QuickJS injects them on device; we install
// them on globalThis). See ../HOST-API.md. Tool-side internals stay untyped JS.

export {};

/** The host shim surface the emulator implements (tool → host). */
export interface HostApi {
  // Display (1-bit 128×64 OLED) — color/value 0=black, 1=white
  clear_screen(): void;
  fill_rect(x: number, y: number, w: number, h: number, value: number | boolean): void;
  draw_rect(x: number, y: number, w: number, h: number, value: number | boolean): void;
  set_pixel(x: number, y: number, value: number | boolean): void;
  print(x: number, y: number, text: unknown, color?: number): void;
  text_width(text: unknown): number;
  host_flush_display(): void;
  // LEDs
  setLED(idx: number, color: number): void;
  setButtonLED(cc: number, color: number, force?: boolean): void;
  clearAllLEDs(): void;
  // Params (DSP bridge) — get returns null when absent (host semantics)
  host_module_get_param(key: string): string | null;
  host_module_set_param(key: string, val: string | number): void;
  // State persistence
  host_write_file(path: string, data: string): number;
  host_read_file(path: string): string | null;
  host_file_exists(path: string): number;
  host_ensure_dir(path: string): number;
  host_remove_dir(path: string): number;
  // MIDI out
  move_midi_internal_send(pkt: number[]): void; // also carries LED writes
  move_midi_inject_to_move(pkt: number[]): void;
  shadow_send_midi_to_dsp(...args: unknown[]): void;
  // co-run (native-editor delegation)
  shadow_corun_begin(target: number, id: number, keepMask: number): void;
  shadow_corun_end(...args: unknown[]): void;
  shadow_corun_state(): { target: number; id: number; keep_mask: number } | null;
  shadow_get_slots(): Array<Record<string, unknown>>;
  shadow_get_param(slot: number, key: string): string | null;
  shadow_set_param(slot: number, key: string, val: string | number): boolean;
  host_get_volume(): number;
  host_set_volume(volume: number): void;
  host_list_modules(): Array<Record<string, unknown>>;
  shadow_get_ui_flags(): Record<string, unknown>;
}

declare global {
  // Entry points (host → tool): defined by the tool, called by the host loop.
  var init: (() => void) | undefined;
  var tick: (() => void) | undefined;
  // Host delivers a [status, d1, d2] packet (single array arg).
  var onMidiMessageInternal: ((data: number[]) => void) | undefined;
  var onMidiMessageExternal: ((data: number[]) => void) | undefined;

  // Host shims (installed by main.ts).
  var clear_screen: HostApi["clear_screen"];
  var fill_rect: HostApi["fill_rect"];
  var draw_rect: HostApi["draw_rect"];
  var set_pixel: HostApi["set_pixel"];
  var print: HostApi["print"];
  var text_width: HostApi["text_width"];
  var host_flush_display: HostApi["host_flush_display"];
  var setLED: HostApi["setLED"];
  var setButtonLED: HostApi["setButtonLED"];
  var clearAllLEDs: HostApi["clearAllLEDs"];
  var move_midi_internal_send: HostApi["move_midi_internal_send"];
  var host_module_get_param: HostApi["host_module_get_param"];
  var host_module_set_param: HostApi["host_module_set_param"];
  var host_write_file: HostApi["host_write_file"];
  var host_read_file: HostApi["host_read_file"];
  var host_file_exists: HostApi["host_file_exists"];
  var host_ensure_dir: HostApi["host_ensure_dir"];
  var host_remove_dir: HostApi["host_remove_dir"];
  var move_midi_inject_to_move: HostApi["move_midi_inject_to_move"];
  var shadow_send_midi_to_dsp: HostApi["shadow_send_midi_to_dsp"];
  var shadow_corun_begin: HostApi["shadow_corun_begin"];
  var shadow_corun_end: HostApi["shadow_corun_end"];
  var shadow_corun_state: HostApi["shadow_corun_state"];
  var shadow_get_slots: HostApi["shadow_get_slots"];
  var shadow_get_param: HostApi["shadow_get_param"];
  var shadow_set_param: HostApi["shadow_set_param"];
  var host_get_volume: HostApi["host_get_volume"];
  var host_set_volume: HostApi["host_set_volume"];
  var host_list_modules: HostApi["host_list_modules"];
  var shadow_get_ui_flags: HostApi["shadow_get_ui_flags"];

  // Console/test harness published by the browser emulator host.
  var OVT: unknown;
  var __OVT_MANUAL_GESTURE: string | undefined;
  var __OVT_MANUAL_CONTROLS: string | undefined;
  var __OVT_MANUAL_SHOWING: string | undefined;
  // Draw-order text of the current OLED frame; mirrored by the emulator's display
  // sink so tests can assert what the screen actually shows.
  var __OVT_OLED_TEXT: string | undefined;
}
