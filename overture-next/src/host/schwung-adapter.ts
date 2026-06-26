import type { CoreState, HostCommand } from "../core/types";
import type { MoveMidiPacket, OvertureHostAdapter } from "./types";

const CIN_NOTE_OFF = 0x08;
const CIN_NOTE_ON = 0x09;

type HostFunction = (...args: unknown[]) => unknown;
type GlobalHost = Record<string, unknown>;

export function moveCommandToPacket(command: HostCommand): MoveMidiPacket {
  if (command.kind === "move-note-on") {
    return [(2 << 4) | CIN_NOTE_ON, 0x90 | (command.track & 0x0f), command.note & 0x7f, command.velocity & 0x7f];
  }
  return [(2 << 4) | CIN_NOTE_OFF, 0x80 | (command.track & 0x0f), command.note & 0x7f, 0];
}

export function createSchwungAdapter(host: GlobalHost = globalThis): OvertureHostAdapter {
  function call(name: string, args: unknown[]): unknown {
    const fn = host[name];
    if (typeof fn === "function") return (fn as HostFunction)(...args);
    return undefined;
  }

  const adapter: OvertureHostAdapter = {
    runtime: {
      publishState(state: CoreState) {
        host.overtureUiState = state;
      },
    },
    display: {
      splashSurface: {
        clear: () => adapter.display.clear(),
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
      setLed(index, color) {
        call("setLED", [index, color]);
      },
      setButtonLed(cc, color) {
        call("setButtonLED", [cc, color, true]);
      },
    },
    midi: {
      sendMovePacket(packet) {
        call("move_midi_inject_to_move", [packet]);
      },
    },
    commands: {
      execute(command) {
        adapter.midi.sendMovePacket(moveCommandToPacket(command));
      },
    },
  };
  return adapter;
}
