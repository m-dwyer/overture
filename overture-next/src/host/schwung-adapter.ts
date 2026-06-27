import type { CoreInput } from "../core/input";
import type { CoreState, HostCommand } from "../core/types";
import type { MoveMidiPacket, OvertureHostAdapter } from "./types";

const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const CC = 0xb0;

const STEP_NOTE_FIRST = 16;
const PAD_NOTE_FIRST = 68;
const PAD_COUNT = 32;
const ROW_CC = [43, 42, 41, 40] as const;

const CC_SHIFT = 49;
const CC_MENU = 50;
const CC_PLAY = 85;

const CIN_NOTE_OFF = 0x08;
const CIN_NOTE_ON = 0x09;

type HostFunction = (...args: unknown[]) => unknown;
type GlobalHost = Record<string, unknown>;

export function moveCommandToPacket(command: HostCommand): MoveMidiPacket {
  const channel = moveChannelForTrack(command.trackIndex);
  if (command.kind === "track-note-on") {
    return [(2 << 4) | CIN_NOTE_ON, 0x90 | channel, command.note & 0x7f, command.velocity & 0x7f];
  }
  return [(2 << 4) | CIN_NOTE_OFF, 0x80 | channel, command.note & 0x7f, 0];
}

function moveChannelForTrack(trackIndex: number): number {
  return trackIndex & 0x0f;
}

export function moveMidiToInput(data: readonly number[], stepCount: number): CoreInput | null {
  const status = (data[0] ?? 0) & 0xf0;
  const d1 = (data[1] ?? 0) | 0;
  const d2 = (data[2] ?? 0) | 0;

  if (status === CC) return parseMoveCc(d1, d2);
  if ((status === NOTE_ON && d2 > 0) || status === NOTE_OFF || (status === NOTE_ON && d2 === 0)) {
    return parseMoveNote(status, d1, d2, stepCount);
  }
  return null;
}

function parseMoveCc(cc: number, value: number): CoreInput | null {
  if (cc === CC_SHIFT) return { kind: "shift", held: value > 0 };
  if (value === 0) return null;
  if (cc === CC_PLAY) return { kind: "play" };
  if (cc === CC_MENU) return { kind: "menu" };
  const row = ROW_CC.indexOf(cc as (typeof ROW_CC)[number]);
  if (row >= 0) return { kind: "track-row", row };
  return null;
}

function parseMoveNote(status: number, note: number, velocity: number, stepCount: number): CoreInput | null {
  if (status !== NOTE_ON || velocity <= 0) return null;
  if (note >= PAD_NOTE_FIRST && note < PAD_NOTE_FIRST + PAD_COUNT) return { kind: "pad", padIndex: note - PAD_NOTE_FIRST };
  if (note < STEP_NOTE_FIRST || note >= STEP_NOTE_FIRST + stepCount) return null;
  return { kind: "step", step: note - STEP_NOTE_FIRST };
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
        host.overtureUiState = { ...state, activeTrack: state.selectedTrackIndex };
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
      setStepLed(step, color) {
        call("setLED", [STEP_NOTE_FIRST + step, color]);
      },
      setTrackRowLed(row, color) {
        const cc = ROW_CC[row];
        if (cc !== undefined) call("setButtonLED", [cc, color, true]);
      },
      setPlayLed(color) {
        call("setButtonLED", [CC_PLAY, color, true]);
      },
      setMenuLed(color) {
        call("setButtonLED", [CC_MENU, color, true]);
      },
    },
    input: {
      parseMoveInput(data, stepCount) {
        return moveMidiToInput(data, stepCount);
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
