import type { ControlInput } from "../core/controls/types";
import type { DisplayPort, HostCommandPort, LedPort, RuntimePort } from "../ports/types";

export type MoveMidiPacket = readonly [number, number, number, number];

export interface MidiPort {
  sendMovePacket(packet: MoveMidiPacket): void;
}

export interface InputPort {
  parseMoveInput(data: readonly number[], stepCount: number): ControlInput | null;
}

export interface OvertureHostAdapter {
  runtime: RuntimePort;
  display: DisplayPort;
  leds: LedPort;
  input: InputPort;
  midi: MidiPort;
  commands: HostCommandPort;
}
