/**
 * Ambient declarations for the Schwung HOST seam — the globals the QuickJS host
 * injects into the UI Runtime at load (NOT JS imports; the host provides them).
 * This is the type surface of the imperative shell's boundary with the platform.
 *
 * Script-style .d.ts (no import/export), so every `declare` below is a global.
 * Signatures are intentionally loose — the host is dynamically typed; tighten a
 * signature only when a caller actually depends on the shape. Add globals here as
 * modules that use them join tsconfig `include`.
 */

// --- Host shared MODULES (facades re-export the on-device absolute path) ---
declare module '/data/UserData/schwung/shared/constants.mjs' {
  export const Black: number;
  export const DarkGrey: number;
  export const LightGrey: number;
  export const White: number;
  export const BrightRed: number;
  export const DeepRed: number;
  export const HotMagenta: number;
  export const BrightPink: number;
  export const LightMagenta: number;
  export const DeepViolet: number;
  export const DarkPurple: number;
  export const DeepMagenta: number;
  export const DeepWine: number;
  export const Bright: number;
  export const LightYellow: number;
  export const VividYellow: number;
  export const BurntOrange: number;
  export const Mustard: number;
  export const DeepBrownYellow: number;
  export const Olive: number;
  export const DarkOlive: number;
  export const BrightGreen: number;
  export const Cyan: number;
  export const DeepGreen: number;
  export const OliveGreen: number;
  export const DarkOliveGreen: number;
  export const DarkGrassGreen: number;
  export const DarkTeal: number;
  export const DeepTeal: number;
  export const RoyalBlue: number;
  export const SkyBlue: number;
  export const LightBlue: number;
  export const DeepBlue: number;
  export const DarkBlue: number;
  export const DeepBlueIndigo: number;
  export const PurpleBlue: number;
  export const DarkIndigo: number;
  export const BlueViolet: number;
  export const Purple: number;
  export const DeepPlum: number;
  export const DarkViolet: number;
  export const WinePurple: number;
  export const DarkRose: number;
  export const Blue: number;
  export const Green: number;
  export const Red: number;
  export const MidiNoteOff: number;
  export const MidiNoteOn: number;
  export const MidiPolyAftertouch: number;
  export const MidiCC: number;
  export const MidiPC: number;
  export const MidiChAftertouch: number;
  export const MidiWheel: number;
  export const MidiSysexStart: number;
  export const MidiSysexEnd: number;
  export const MidiClock: number;
  export const MidiCCOn: number;
  export const MidiCCOff: number;
  export const MoveMainTouch: number;
  export const MoveMainButton: number;
  export const MoveMainKnob: number;
  export const MoveShift: number;
  export const MoveMenu: number;
  export const MoveBack: number;
  export const MoveCapture: number;
  export const MoveDown: number;
  export const MoveUp: number;
  export const MoveUndo: number;
  export const MoveLoop: number;
  export const MoveCopy: number;
  export const MoveLeft: number;
  export const MoveRight: number;
  export const MovePlay: number;
  export const MoveRec: number;
  export const MoveMute: number;
  export const MoveRecord: number;
  export const MoveSample: number;
  export const MoveDelete: number;
  export const MovePads: number[];
  export const MoveSteps: number[];
  export const MoveCCButtons: number[];
  export const MoveNoteButtons: number[];
  export const MoveRGBLeds: number[];
  export const MoveWhiteLeds: number[];
}
declare module '/data/UserData/schwung/shared/input_filter.mjs' {
  export function isNoiseMessage(data: number[]): boolean;
  export function setLED(note: number, color: number, force?: boolean): void;
  export function setButtonLED(cc: number, color: number, force?: boolean): void;
  export function decodeDelta(value: number): number;
}
declare module '/data/UserData/schwung/shared/logger.mjs' {
  export function installConsoleOverride(moduleName: string): void;
}
declare module '/data/UserData/schwung/shared/menu_items.mjs' {
  export function createInfo(label: string, value: any): any;
  export function createValue(label: string, options: any): any;
  export function createEnum(label: string, options: any): any;
  export function createToggle(label: string, options: any): any;
  export function createAction(label: string, onAction: Function): any;
  export function createDivider(label?: string): any;
  export function formatItemValue(item: any, editing?: boolean, editValue?: any): string;
}
declare module '/data/UserData/schwung/shared/menu_nav.mjs' {
  export function createMenuState(): any;
  export function handleMenuInput(...args: any[]): any;
}
declare module '/data/UserData/schwung/shared/menu_stack.mjs' {
  export function createMenuStack(): any;
}
declare module '/data/UserData/schwung/shared/menu_layout.mjs' {
  export function drawMenuHeader(title: string, titleRight?: string): void;
  export function drawMenuList(options: any): void;
  export const menuLayoutDefaults: any;
}
declare module '/data/UserData/schwung/shared/*';

// --- Build-time feature flag (NOT a host global) ---
// Replaced by a literal at bundle time via esbuild `--define:OVERTURE_DEBUG_LOG=...`
// (false for production, true for `OVERTURE_DEBUG_LOG=1 ./scripts/bundle_ui.sh`;
// vitest defines it true). Declared here only so `tsc`/the source resolve it.
// Every call site is `OVERTURE_DEBUG_LOG && dlog(...)`, so a false define folds
// to `false && ...` and esbuild DCE removes the call AND tree-shakes the logger
// module out of production entirely. See core/ui_debug_log.mjs.
declare const OVERTURE_DEBUG_LOG: boolean;

// --- Module param bridge (UI <-> DSP) ---
declare function host_module_set_param(key: string, val: string): void;
declare function host_module_get_param(key: string): string | null;

// --- Persistence ---
declare function host_write_file(path: string, data: string): boolean;
declare function host_read_file(path: string): string | null;
declare function host_ensure_dir(path: string): boolean;
declare function host_file_exists(path: string): boolean;

// --- Module lifecycle ---
declare function host_exit_module(): void;
declare function host_hide_module(): void;

// --- MIDI / DSP delivery (also commonly passed inward as deps) ---
declare function shadow_send_midi_to_dsp(bytes: number[]): void;
declare function shadow_get_param(slot: number, key: string): string | null;
declare function shadow_set_param(slot: number, key: string, value: string): boolean | void;
declare function move_midi_internal_send(bytes: number[]): void;
declare function move_midi_external_send(bytes: number[]): void;

// --- OLED draw primitives ---
declare function set_pixel(x: number, y: number, on: number): void;
declare function pixelPrint(...args: any[]): void;
declare function pixelPrintC(...args: any[]): void;
declare function fill_rect(...args: any[]): void;
declare function clear_screen(): void;
declare function print(...args: any[]): void;
