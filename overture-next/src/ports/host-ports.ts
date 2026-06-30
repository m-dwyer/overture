import type { ControlSurfacePort } from "./inbound";
import type {
  DisplayPort,
  HostCommandPort,
  LedPort,
  MidiPort,
  RuntimePort,
  SchwungChainReadPort,
} from "./outbound";

export interface OvertureInboundPorts {
  controlSurface: ControlSurfacePort;
}

export interface OvertureOutboundPorts {
  runtime: RuntimePort;
  display: DisplayPort;
  leds: LedPort;
  midi: MidiPort;
  commands: HostCommandPort;
  schwungChains?: SchwungChainReadPort;
}

export interface OvertureHostPorts {
  inbound: OvertureInboundPorts;
  outbound: OvertureOutboundPorts;
}
