import type { ControlInput } from "../application/controls/types";
import type { HostCommand } from "../application/host-commands";
import type { CoreSnapshot } from "../application/types";
import { assertNever } from "../shared/assert-never";
import { SchwungChainReader } from "./schwung-chain-reader";
import {
  CC,
  NAV,
  NOTE_OFF,
  NOTE_ON,
  PAD_COUNT,
  PAD_NOTE0,
  ROW_CC,
  SCHWUNG_SLOT_CHANNEL_FIRST,
  STEP_CC0,
} from "./move-controls";
import type { OvertureHostPorts } from "../ports/host-ports";
import type { MoveMidiPacket, SchwungMidiMessage } from "../ports/outbound";

const CIN_NOTE_OFF = 0x08;
const CIN_NOTE_ON = 0x09;

type HostFunction = (...args: unknown[]) => unknown;
type GlobalHost = Record<string, unknown>;

export function moveCommandToPacket(command: HostCommand): MoveMidiPacket {
  if (command.route.kind !== "move")
    throw new Error("Cannot convert non-Move command to Move packet");
  const channel = command.route.moveTrackTarget & 0x0f;
  switch (command.kind) {
    case "track-note-on":
      return [
        (2 << 4) | CIN_NOTE_ON,
        NOTE_ON | channel,
        command.note & 0x7f,
        command.velocity & 0x7f,
      ];
    case "track-note-off":
      return [
        (2 << 4) | CIN_NOTE_OFF,
        NOTE_OFF | channel,
        command.note & 0x7f,
        0,
      ];
    default:
      return assertNever(command);
  }
}

export function schwungCommandToMessage(
  command: HostCommand,
): SchwungMidiMessage {
  if (command.route.kind !== "schwung")
    throw new Error("Cannot convert non-Schwung command to Schwung message");
  const channel =
    (SCHWUNG_SLOT_CHANNEL_FIRST + command.route.schwungChainIndex) & 0x0f;
  switch (command.kind) {
    case "track-note-on":
      return [NOTE_ON | channel, command.note & 0x7f, command.velocity & 0x7f];
    case "track-note-off":
      return [NOTE_OFF | channel, command.note & 0x7f, 0];
    default:
      return assertNever(command);
  }
}

export function moveMidiToInput(
  data: readonly number[],
  stepCount: number,
): ControlInput | null {
  const status = (data[0] ?? 0) & 0xf0;
  const d1 = (data[1] ?? 0) | 0;
  const d2 = (data[2] ?? 0) | 0;

  if (status === CC) return parseMoveCc(d1, d2);
  if (
    (status === NOTE_ON && d2 > 0) ||
    status === NOTE_OFF ||
    (status === NOTE_ON && d2 === 0)
  ) {
    return parseMoveNote(status, d1, d2, stepCount);
  }
  return null;
}

function parseMoveCc(cc: number, value: number): ControlInput | null {
  if (cc === NAV.Shift) return { kind: "shift", held: value > 0 };
  if (value === 0) return null;
  if (cc === NAV.Play) return { kind: "play" };
  if (cc === NAV.Menu) return { kind: "menu" };
  const row = ROW_CC.indexOf(cc as (typeof ROW_CC)[number]);
  if (row >= 0) return { kind: "track-row", row };
  return null;
}

function parseMoveNote(
  status: number,
  note: number,
  velocity: number,
  stepCount: number,
): ControlInput | null {
  if (note >= PAD_NOTE0 && note < PAD_NOTE0 + PAD_COUNT) {
    const held = status === NOTE_ON && velocity > 0;
    return {
      kind: "pad",
      held,
      padIndex: note - PAD_NOTE0,
      velocity: held ? velocity : 0,
    };
  }
  if (status !== NOTE_ON || velocity <= 0) return null;
  if (note < STEP_CC0 || note >= STEP_CC0 + stepCount) return null;
  return { kind: "step", step: note - STEP_CC0 };
}

export function createSchwungAdapter(
  host: GlobalHost = globalThis,
): OvertureHostPorts {
  function call(name: string, args: unknown[]): unknown {
    const fn = host[name];
    if (typeof fn === "function") return (fn as HostFunction)(...args);
    return undefined;
  }
  const schwungChainReader = new SchwungChainReader(call);

  const hostPorts: OvertureHostPorts = {
    inbound: {
      controlSurface: {
        parseMoveInput(data, stepCount) {
          return moveMidiToInput(data, stepCount);
        },
      },
    },
    outbound: {
      runtime: {
        publishState(snapshot: CoreSnapshot) {
          host.overtureUiState = {
            ...snapshot,
            sessionView: snapshot.activeView === "session",
            activeTrack: snapshot.selectedTrackIndex,
          };
        },
      },
      display: {
        splashSurface: {
          clear: () => hostPorts.outbound.display.clear(),
          fillRect: (x, y, width, height, color) => {
            call("fill_rect", [x, y, width, height, color]);
          },
        },
        clear() {
          call("clear_screen", []);
        },
        print(x, y, text, color) {
          call("print", [x, y, text, color]);
        },
        rect(x, y, width, height, color, fill) {
          if (fill) call("fill_rect", [x, y, width, height, color]);
          else call("draw_rect", [x, y, width, height, color]);
        },
        flush() {
          call("host_flush_display", []);
        },
      },
      leds: {
        setStepLed(step, color) {
          call("setLED", [STEP_CC0 + step, color]);
        },
        setPadLed(padIndex, color) {
          call("setLED", [PAD_NOTE0 + padIndex, color]);
        },
        setTrackRowLed(row, color) {
          const cc = ROW_CC[row];
          if (cc !== undefined) call("setButtonLED", [cc, color, true]);
        },
        setPlayLed(color) {
          call("setButtonLED", [NAV.Play, color, true]);
        },
        setMenuLed(color) {
          call("setButtonLED", [NAV.Menu, color, true]);
        },
      },
      midi: {
        sendMovePacket(packet) {
          call("move_midi_inject_to_move", [packet]);
        },
        sendSchwungMessage(message) {
          call("shadow_send_midi_to_dsp", [message]);
        },
      },
      commands: {
        execute(command) {
          switch (command.route.kind) {
            case "move":
              hostPorts.outbound.midi.sendMovePacket(
                moveCommandToPacket(command),
              );
              return;
            case "schwung":
              hostPorts.outbound.midi.sendSchwungMessage(
                schwungCommandToMessage(command),
              );
              return;
            default:
              assertNever(command.route);
          }
        },
      },
      schwungChains: {
        readChain(chainIndex) {
          return schwungChainReader.readChain(chainIndex);
        },
      },
    },
  };
  return hostPorts;
}
