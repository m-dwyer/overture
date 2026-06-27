import { describe, expect, test } from "vitest";
import { interpretControl } from "../../../overture-next/src/core/controls/interpret-control";
import { applyIntent } from "../../../overture-next/src/core/intents/apply-intent";
import { createOvertureCore } from "../../../overture-next/src/core/core";
import { getClipCell, getClipForCell } from "../../../overture-next/src/core/project";
import type { HostCommand } from "../../../overture-next/src/core/types";

describe("Overture Next control-to-intent pipeline", () => {
  test("interprets track rows against the current shift modifier", () => {
    expect(
      interpretControl(
        { kind: "track-row", row: 1 },
        { shiftHeld: false, controlMode: "track", visibleTrackBank: 0 },
      ),
    ).toEqual({ kind: "select-track", trackIndex: 1 });

    expect(
      interpretControl({ kind: "track-row", row: 1 }, { shiftHeld: true, controlMode: "track", visibleTrackBank: 0 }),
    ).toEqual({ kind: "select-track", trackIndex: 5 });
  });

  test("ignores Track View central pads before domain state changes", () => {
    expect(
      interpretControl({ kind: "pad", padIndex: 7 }, { shiftHeld: false, controlMode: "track", visibleTrackBank: 0 }),
    ).toBeNull();
  });

  test("interprets Session View pads as Clip Cell launch without leaking pad indexes", () => {
    const intent = interpretControl(
      { kind: "pad", padIndex: 26 },
      { shiftHeld: false, controlMode: "session", visibleTrackBank: 1 },
    );

    expect(intent).toEqual({ kind: "launch-clip-cell", coordinate: { trackIndex: 4, sceneIndex: 2 } });
    expect(intent).not.toHaveProperty("padIndex");
  });

  test("applies clip-cell selection without creating clips", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];
    const clipCount = Object.keys(core.state.project.clips).length;

    expect(
      applyIntentAndCollect(
        { kind: "select-clip-cell", coordinate: { trackIndex: 3, sceneIndex: 7 } },
        core.state,
        hostCommands,
      ),
    ).toBe(true);

    expect(core.state.control.selectedTrackIndex).toBe(3);
    expect(core.state.control.selectedClipCell).toEqual({ trackIndex: 3, sceneIndex: 7 });
    expect(Object.keys(core.state.project.clips)).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("applies Clip Cell launch as playback state and explicit UI selection", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];
    const clipCount = Object.keys(core.state.project.clips).length;

    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate: { trackIndex: 2, sceneIndex: 0 } },
        core.state,
        hostCommands,
      ),
    ).toBe(true);

    expect(core.state.control.selectedTrackIndex).toBe(2);
    expect(core.state.control.selectedClipCell).toEqual({ trackIndex: 2, sceneIndex: 0 });
    expect(core.state.playback.tracks[2].playingClipId).toBe("clip-3");
    expect(Object.keys(core.state.project.clips)).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("applies transport toggle without selected-track note-off when no clips are playing", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];

    expect(applyIntentAndCollect({ kind: "toggle-transport" }, core.state, hostCommands)).toBe(true);
    expect(core.state.transport.playing).toBe(true);
    expect(hostCommands).toEqual([]);

    expect(applyIntentAndCollect({ kind: "toggle-transport" }, core.state, hostCommands)).toBe(true);
    expect(core.state.transport.playing).toBe(false);
    expect(hostCommands).toEqual([]);
  });

  test("stopping transport emits note-off for playing clips, not the selected Clip Cell", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];

    expect(
      applyIntentAndCollect(
        { kind: "launch-clip-cell", coordinate: { trackIndex: 2, sceneIndex: 0 } },
        core.state,
        hostCommands,
      ),
    ).toBe(true);
    expect(
      applyIntentAndCollect(
        { kind: "select-clip-cell", coordinate: { trackIndex: 0, sceneIndex: 0 } },
        core.state,
        hostCommands,
      ),
    ).toBe(true);
    expect(applyIntentAndCollect({ kind: "toggle-transport" }, core.state, hostCommands)).toBe(true);
    expect(applyIntentAndCollect({ kind: "toggle-transport" }, core.state, hostCommands)).toBe(true);

    expect(hostCommands).toEqual([{ kind: "track-note-off", trackIndex: 2, note: 60 }]);
  });

  test("returns emitted host commands as a Domain Intent transaction", () => {
    const core = createOvertureCore();

    expect(applyIntent({ kind: "launch-clip-cell", coordinate: { trackIndex: 2, sceneIndex: 0 } }, core.state)).toEqual(
      { applied: true, hostCommands: [] },
    );
    expect(applyIntent({ kind: "toggle-transport" }, core.state)).toEqual({ applied: true, hostCommands: [] });

    expect(applyIntent({ kind: "toggle-transport" }, core.state)).toEqual({
      applied: true,
      hostCommands: [{ kind: "track-note-off", trackIndex: 2, note: 60 }],
    });
  });

  test("applies track selection while preserving the selected scene", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];

    core.state.control.selectedClipCell = { trackIndex: 0, sceneIndex: 7 };

    expect(applyIntentAndCollect({ kind: "select-track", trackIndex: 5 }, core.state, hostCommands)).toBe(true);

    expect(core.state.control.selectedTrackIndex).toBe(5);
    expect(core.state.control.visibleTrackBank).toBe(1);
    expect(core.state.control.selectedClipCell).toEqual({ trackIndex: 5, sceneIndex: 7 });
    expect(hostCommands).toEqual([]);
  });

  test("applies step toggles only to the selected clip sequence", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];
    const selectedClip = getClipForCell(core.state.project, core.state.control.selectedClipCell);
    const otherClipId = getClipCell(core.state.project, { trackIndex: 1, sceneIndex: 0 }).clipId;
    if (!selectedClip || !otherClipId) throw new Error("Expected default clips");
    const otherClip = core.state.project.clips[otherClipId];

    expect(selectedClip.sequence.steps[1].active).toBe(false);
    expect(otherClip.sequence.steps[1].active).toBe(false);

    expect(applyIntentAndCollect({ kind: "toggle-step", stepIndex: 1 }, core.state, hostCommands)).toBe(true);

    expect(core.state.control.selectedStep).toBe(1);
    expect(selectedClip.sequence.steps[1].active).toBe(true);
    expect(otherClip.sequence.steps[1].active).toBe(false);
    expect(hostCommands).toEqual([]);
  });

  test("applies shift state without changing selection or host commands", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];

    expect(applyIntentAndCollect({ kind: "set-shift-held", held: true }, core.state, hostCommands)).toBe(true);

    expect(core.state.control.shiftHeld).toBe(true);
    expect(core.state.control.selectedTrackIndex).toBe(0);
    expect(core.state.control.selectedClipCell).toEqual({ trackIndex: 0, sceneIndex: 0 });
    expect(hostCommands).toEqual([]);
  });

  test("lets domain guards reject invalid track and clip-cell coordinates", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];

    expect(() => applyIntentAndCollect({ kind: "select-track", trackIndex: 99 }, core.state, hostCommands)).toThrow(
      "Missing track 99",
    );
    expect(() =>
      applyIntentAndCollect(
        { kind: "select-clip-cell", coordinate: { trackIndex: 0, sceneIndex: 99 } },
        core.state,
        hostCommands,
      ),
    ).toThrow("Missing clip cell 0:99");
    expect(hostCommands).toEqual([]);
  });
});

function applyIntentAndCollect(
  intent: Parameters<typeof applyIntent>[0],
  state: Parameters<typeof applyIntent>[1],
  hostCommands: HostCommand[],
): boolean {
  const transaction = applyIntent(intent, state);
  hostCommands.push(...transaction.hostCommands);
  return transaction.applied;
}
