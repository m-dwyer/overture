import type { HostApi } from "../host-api.js";
import type { LedSink } from "./sinks.js";

type LedHostApi = Pick<
  HostApi,
  "setLED" | "setButtonLED" | "clearAllLEDs" | "move_midi_internal_send"
>;

function usbMidiSysexBytes(packet: number[]): number[] {
  const bytes: number[] = [];
  for (let i = 0; i < packet.length; i += 4) {
    const cin = packet[i] & 0x0f;
    const count =
      cin === 0x05
        ? 1
        : cin === 0x06
          ? 2
          : cin === 0x07 || cin === 0x04
            ? 3
            : 0;
    for (let j = 0; j < count; j++) bytes.push(packet[i + 1 + j] ?? 0);
  }
  return bytes;
}

function parsePaletteEntry(
  packet: number[],
): { index: number; r: number; g: number; b: number } | null {
  const bytes = usbMidiSysexBytes(packet);
  if (
    bytes.length < 17 ||
    bytes[0] !== 0xf0 ||
    bytes[1] !== 0x00 ||
    bytes[2] !== 0x21 ||
    bytes[3] !== 0x1d ||
    bytes[4] !== 0x01 ||
    bytes[5] !== 0x01 ||
    bytes[6] !== 0x03
  )
    return null;
  return {
    index: bytes[7] & 0x7f,
    r: Math.min(255, (bytes[8] & 0x7f) | ((bytes[9] & 0x7f) << 7)),
    g: Math.min(255, (bytes[10] & 0x7f) | ((bytes[11] & 0x7f) << 7)),
    b: Math.min(255, (bytes[12] & 0x7f) | ((bytes[13] & 0x7f) << 7)),
  };
}

export function createLedHostApi(leds: LedSink): LedHostApi {
  return {
    setLED(index: number, color: number): void {
      leds.setLED(index, color);
    },
    setButtonLED(cc: number, color: number): void {
      leds.setButtonLED(cc, color);
    },
    clearAllLEDs(): void {
      leds.clearAll();
    },
    move_midi_internal_send(packet: number[]): void {
      const palette = parsePaletteEntry(packet);
      if (palette) {
        leds.setPaletteEntryRGB?.(
          palette.index,
          palette.r,
          palette.g,
          palette.b,
        );
        return;
      }
      const status = (packet[1] ?? 0) & 0xf0;
      const index = packet[2] ?? 0;
      const color = packet[3] ?? 0;
      if (status === 0x90) leds.setLED(index, color);
      else if (status === 0xb0) leds.setButtonLED(index, color);
    },
  };
}
