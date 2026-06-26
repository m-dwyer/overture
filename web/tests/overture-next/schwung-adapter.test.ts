import { describe, expect, test } from "vitest";
import { createSchwungAdapter, moveCommandToPacket } from "../../../overture-next/src/host/schwung-adapter";
import { installSchwungRuntime } from "../../../overture-next/src/host/schwung-runtime";

describe("Overture Next Schwung adapter", () => {
  test("converts domain note commands to Move USB-MIDI packets", () => {
    expect(moveCommandToPacket({ kind: "move-note-on", track: 2, note: 64, velocity: 101 })).toEqual([
      0x29,
      0x92,
      64,
      101,
    ]);
    expect(moveCommandToPacket({ kind: "move-note-off", track: 2, note: 64 })).toEqual([0x28, 0x82, 64, 0]);
  });

  test("masks packet fields to the MIDI ranges used by Move", () => {
    expect(moveCommandToPacket({ kind: "move-note-on", track: 18, note: 200, velocity: 255 })).toEqual([
      0x29,
      0x92,
      72,
      127,
    ]);
  });

  test("executes domain commands through the MIDI port without exposing raw injection helpers", () => {
    const packets: unknown[] = [];
    const host = {
      move_midi_inject_to_move(packet: unknown) {
        packets.push(packet);
      },
    } as Record<string, unknown>;
    const adapter = createSchwungAdapter(host);

    adapter.commands.execute({ kind: "move-note-on", track: 1, note: 60, velocity: 90 });

    expect(packets).toEqual([[0x29, 0x91, 60, 90]]);
    expect("injectMoveNoteOn" in adapter).toBe(false);
    expect("injectMoveNoteOff" in adapter).toBe(false);
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
