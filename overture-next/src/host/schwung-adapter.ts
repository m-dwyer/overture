import type { CoreState, OvertureHostAdapter } from "../core/types";

const CIN_NOTE_OFF = 0x08;
const CIN_NOTE_ON = 0x09;

type HostFunction = (...args: unknown[]) => unknown;
type GlobalHost = typeof globalThis & Record<string, unknown>;

export function createSchwungAdapter(): OvertureHostAdapter {
  function call(name: string, args: unknown[]): unknown {
    const fn = (globalThis as GlobalHost)[name];
    if (typeof fn === "function") return (fn as HostFunction)(...args);
    return undefined;
  }

  function injectMovePacket(packet: number[]): void {
    call("move_midi_inject_to_move", [packet]);
  }

  const adapter: OvertureHostAdapter = {
    splashSurface: {
      clear_screen: () => adapter.clear(),
      fill_rect: (x, y, width, height, color) => {
        call("fill_rect", [x, y, width, height, color]);
      },
    },
    publishState(state: CoreState) {
      (globalThis as GlobalHost).overtureUiState = state;
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
    setLed(index, color) {
      call("setLED", [index, color]);
    },
    setButtonLed(cc, color) {
      call("setButtonLED", [cc, color, true]);
    },
    injectMoveNoteOn(track, note, velocity) {
      injectMovePacket([(2 << 4) | CIN_NOTE_ON, 0x90 | (track & 0x0f), note & 0x7f, velocity & 0x7f]);
    },
    injectMoveNoteOff(track, note) {
      injectMovePacket([(2 << 4) | CIN_NOTE_OFF, 0x80 | (track & 0x0f), note & 0x7f, 0]);
    },
  };
  return adapter;
}
