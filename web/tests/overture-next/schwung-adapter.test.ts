import { describe, expect, test } from "vitest";
import type { CoreSnapshot } from "../../../overture-next/src/core/types";
import {
  createSchwungAdapter,
  moveCommandToPacket,
  moveMidiToInput,
  schwungCommandToMessage,
} from "../../../overture-next/src/host/schwung-adapter";
import { installSchwungRuntime } from "../../../overture-next/src/host/schwung-runtime";

const moveRoute = { kind: "move" as const, moveTrackTarget: 2 };
const schwungRoute = { kind: "schwung" as const, schwungChainIndex: 0 };

describe("Overture Next Schwung adapter", () => {
  test("converts Move CC and note input to control input", () => {
    expect(moveMidiToInput([0xb0, 85, 127], 16)).toEqual({ kind: "play" });
    expect(moveMidiToInput([0xb0, 50, 127], 16)).toEqual({ kind: "menu" });
    expect(moveMidiToInput([0xb0, 49, 127], 16)).toEqual({ kind: "shift", held: true });
    expect(moveMidiToInput([0xb0, 49, 0], 16)).toEqual({ kind: "shift", held: false });
    expect(moveMidiToInput([0xb0, 42, 127], 16)).toEqual({ kind: "track-row", row: 1 });
    expect(moveMidiToInput([0x90, 17, 100], 16)).toEqual({ kind: "step", step: 1 });
    expect(moveMidiToInput([0x90, 68, 110], 16)).toEqual({ kind: "pad", held: true, padIndex: 0, velocity: 110 });
    expect(moveMidiToInput([0x90, 99, 110], 16)).toEqual({ kind: "pad", held: true, padIndex: 31, velocity: 110 });
    expect(moveMidiToInput([0x80, 68, 0], 16)).toEqual({ kind: "pad", held: false, padIndex: 0, velocity: 0 });
    expect(moveMidiToInput([0x90, 68, 0], 16)).toEqual({ kind: "pad", held: false, padIndex: 0, velocity: 0 });
  });

  test("ignores unhandled or released Move input before it reaches core", () => {
    expect(moveMidiToInput([0xb0, 85, 0], 16)).toBeNull();
    expect(moveMidiToInput([0x80, 17, 0], 16)).toBeNull();
    expect(moveMidiToInput([0x90, 17, 0], 16)).toBeNull();
    expect(moveMidiToInput([0x90, 40, 100], 16)).toBeNull();
    expect(moveMidiToInput([0xe0, 0, 64], 16)).toBeNull();
  });

  test("converts domain note commands to Move USB-MIDI packets", () => {
    expect(moveCommandToPacket({ kind: "track-note-on", route: moveRoute, trackIndex: 2, note: 64, velocity: 101 })).toEqual([
      0x29,
      0x92,
      64,
      101,
    ]);
    expect(moveCommandToPacket({ kind: "track-note-off", route: moveRoute, trackIndex: 2, note: 64 })).toEqual([
      0x28,
      0x82,
      64,
      0,
    ]);
  });

  test("uses route targets and masks packet fields to the MIDI ranges used by Move", () => {
    expect(
      moveCommandToPacket({
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 18 },
        trackIndex: 2,
        note: 200,
        velocity: 255,
      }),
    ).toEqual([
      0x29,
      0x92,
      72,
      127,
    ]);
  });

  test("converts Schwung-routed note commands to slot MIDI messages", () => {
    expect(
      schwungCommandToMessage({ kind: "track-note-on", route: schwungRoute, trackIndex: 4, note: 60, velocity: 90 }),
    ).toEqual([0x94, 60, 90]);
    expect(schwungCommandToMessage({ kind: "track-note-off", route: schwungRoute, trackIndex: 4, note: 60 })).toEqual([
      0x84,
      60,
      0,
    ]);
  });

  test("executes routed domain commands through the matching MIDI host path", () => {
    const packets: unknown[] = [];
    const schwungMessages: unknown[] = [];
    const host = {
      move_midi_inject_to_move(packet: unknown) {
        packets.push(packet);
      },
      shadow_send_midi_to_dsp(message: unknown) {
        schwungMessages.push(message);
      },
    } as Record<string, unknown>;
    const adapter = createSchwungAdapter(host);

    adapter.commands.execute({
      kind: "track-note-on",
      route: { kind: "move", moveTrackTarget: 1 },
      trackIndex: 1,
      note: 60,
      velocity: 90,
    });
    adapter.commands.execute({ kind: "track-note-on", route: schwungRoute, trackIndex: 4, note: 60, velocity: 90 });

    expect(packets).toEqual([[0x29, 0x91, 60, 90]]);
    expect(schwungMessages).toEqual([[0x94, 60, 90]]);
    expect("injectMoveNoteOn" in adapter).toBe(false);
    expect("injectMoveNoteOff" in adapter).toBe(false);
  });

  test("maps domain LED targets to Move pad and button LEDs", () => {
    const calls: unknown[][] = [];
    const host = {
      setLED(...args: unknown[]) {
        calls.push(["setLED", ...args]);
      },
      setButtonLED(...args: unknown[]) {
        calls.push(["setButtonLED", ...args]);
      },
    } as Record<string, unknown>;
    const adapter = createSchwungAdapter(host);

    adapter.leds.setStepLed(2, 48);
    adapter.leds.setPadLed(3, 120);
    adapter.leds.setTrackRowLed(1, 120);
    adapter.leds.setPlayLed(16);
    adapter.leds.setMenuLed(44);

    expect(calls).toEqual([
      ["setLED", 18, 48],
      ["setLED", 71, 120],
      ["setButtonLED", 42, 120, true],
      ["setButtonLED", 85, 16, true],
      ["setButtonLED", 50, 44, true],
    ]);
  });

  test("publishes snapshot-derived debug state without raw core internals", () => {
    const host = {} as Record<string, unknown>;
    const adapter = createSchwungAdapter(host);
    const snapshot: CoreSnapshot = {
      selectedTrackIndex: 3,
      selectedTrackRoute: { kind: "move", moveTrackTarget: 3 },
      visibleTrackBank: 0,
      controlMode: "session",
      shiftHeld: false,
      selectedStep: 0,
      playing: false,
      selectedClipId: null,
      selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
      clipCells: [{ trackIndex: 3, sceneIndex: 7, clipId: null }],
      steps: [
        { index: 0, active: true, note: 60, velocity: 100, selected: true, playhead: true },
      ],
    };

    adapter.runtime.publishState(snapshot);

    expect(host.overtureUiState).toMatchObject({
      selectedTrackIndex: 3,
      selectedClipCell: { trackIndex: 3, sceneIndex: 7 },
      sessionView: true,
      activeTrack: 3,
    });
    expect(host.overtureUiState).not.toHaveProperty("control");
    expect(host.overtureUiState).not.toHaveProperty("project");
  });

  test("keeps Schwung global entrypoint installation in host runtime code", () => {
    const calls: string[] = [];
    const host = {} as Record<string, unknown>;

    installSchwungRuntime(
      {
        init: () => calls.push("init"),
        tick: () => calls.push("tick"),
        onMidiMessageInternal: (data) => calls.push("internal:" + data.join(",")),
        onMidiMessageExternal: (data) => calls.push("external:" + data.join(",")),
        onUnload: () => calls.push("unload"),
      },
      { overtureNext: { marker: true } },
      host,
    );

    (host.init as () => void)();
    (host.tick as () => void)();
    (host.onMidiMessageInternal as (data: unknown) => void)([0x90, 60, 100]);
    (host.onMidiMessageExternal as (data: unknown) => void)(null);
    (host.onUnload as () => void)();

    expect(host.overtureNext).toEqual({ marker: true });
    expect(calls).toEqual(["init", "tick", "internal:144,60,100", "external:", "unload"]);
  });
});
