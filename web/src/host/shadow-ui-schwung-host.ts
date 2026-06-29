import type { HostApi } from "../host-api.js";
import { CC, MIDI_STATUS_TYPE_MASK, VOLUME_CC } from "../lib/move-controls.js";
import type { BrowserSchwungHost } from "../schwung/browser-chain.js";
import type { MidiSink } from "./sinks.js";

interface CorunState {
  target: number;
  id: number;
  keep_mask: number;
}

export interface SchwungHostApi {
  api: Pick<
    HostApi,
    | "move_midi_inject_to_move"
    | "shadow_send_midi_to_dsp"
    | "shadow_corun_begin"
    | "shadow_corun_end"
    | "shadow_corun_state"
    | "shadow_get_slots"
    | "shadow_get_param"
    | "shadow_set_param"
    | "host_get_volume"
    | "host_set_volume"
    | "host_list_modules"
    | "shadow_get_ui_flags"
  >;
  handleHostInternalMidi(status: number, d1: number, d2: number): boolean;
}

export function createSchwungHostApi(
  schwung: BrowserSchwungHost,
  midi: MidiSink,
  log: (message: string) => void,
): SchwungHostApi {
  let corunState: CorunState | null = null;

  return {
    api: {
      // Overture chooses HostCommand.route.kind before this point. The emulator
      // only exposes Schwung's raw MIDI host functions as named output sinks.
      move_midi_inject_to_move(packet: number[]): void {
        midi.sendToMove(packet);
      },
      shadow_send_midi_to_dsp(...args: unknown[]): void {
        midi.sendToSchwungChain(args);
        schwung.sendMidiToDsp(args);
      },
      shadow_corun_begin(target: number, id: number, keepMask: number): void {
        corunState = { target, id, keep_mask: keepMask };
        log("corun_begin " + JSON.stringify([target, id, keepMask]));
      },
      shadow_corun_end(): void {
        corunState = null;
        log("corun_end");
      },
      shadow_corun_state(): CorunState | null {
        return corunState ? { ...corunState } : null;
      },
      shadow_get_slots(): Array<Record<string, unknown>> {
        return schwung.shadowGetSlots();
      },
      shadow_get_param(slot: number, key: string): string | null {
        return schwung.shadowGetParam(slot, key);
      },
      shadow_set_param(
        slot: number,
        key: string,
        val: string | number,
      ): boolean {
        const ok = schwung.shadowSetParam(slot, key, val);
        log(
          "shadow_set_param " +
            JSON.stringify([slot | 0, key, String(val ?? ""), ok]),
        );
        return ok;
      },
      host_get_volume(): number {
        return schwung.hostGetVolume();
      },
      host_set_volume(volume: number): void {
        schwung.hostSetVolume(Number(volume));
      },
      host_list_modules(): Array<Record<string, unknown>> {
        return schwung.hostListModules();
      },
      shadow_get_ui_flags(): Record<string, unknown> {
        return {};
      },
    },
    handleHostInternalMidi(status: number, d1: number, d2: number): boolean {
      if ((status & MIDI_STATUS_TYPE_MASK) !== CC || d1 !== VOLUME_CC)
        return false;
      return schwung.handleHostVolumeCc(d2);
    },
  };
}
