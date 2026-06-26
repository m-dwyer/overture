import type { DisplayPort, HostCommandPort, LedPort, RuntimePort } from "../core/types";

export type MoveMidiPacket = readonly [number, number, number, number];

export interface MidiPort {
  sendMovePacket(packet: MoveMidiPacket): void;
}

export interface OvertureHostAdapter {
  runtime: RuntimePort;
  display: DisplayPort;
  leds: LedPort;
  midi: MidiPort;
  commands: HostCommandPort;
}
