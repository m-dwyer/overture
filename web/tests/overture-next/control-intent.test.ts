import { describe, expect, test } from "vitest";
import { interpretControl } from "../../../overture-next/src/core/controls/interpret-control";
import { applyIntent } from "../../../overture-next/src/core/intents/apply-intent";
import { createOvertureCore } from "../../../overture-next/src/core/core";
import { getClipCell, getSelectedClip, selectClipCell } from "../../../overture-next/src/core/project";
import type { HostCommand } from "../../../overture-next/src/core/types";

describe("Overture Next control-to-intent pipeline", () => {
  test("interprets track rows against the current shift modifier", () => {
    expect(
      interpretControl(
        { kind: "track-row", row: 1 },
        { shiftHeld: false, sessionView: false, visibleTrackBank: 0 },
      ),
    ).toEqual({ kind: "select-track", trackIndex: 1 });

    expect(
      interpretControl({ kind: "track-row", row: 1 }, { shiftHeld: true, sessionView: false, visibleTrackBank: 0 }),
    ).toEqual({ kind: "select-track", trackIndex: 5 });
  });

  test("ignores Track View central pads before domain state changes", () => {
    expect(
      interpretControl({ kind: "pad", padIndex: 7 }, { shiftHeld: false, sessionView: false, visibleTrackBank: 0 }),
    ).toBeNull();
  });

  test("interprets Session View pads as clip-cell selection without leaking pad indexes", () => {
    const intent = interpretControl(
      { kind: "pad", padIndex: 26 },
      { shiftHeld: false, sessionView: true, visibleTrackBank: 1 },
    );

    expect(intent).toEqual({ kind: "select-clip-cell", coordinate: { trackIndex: 4, sceneIndex: 2 } });
    expect(intent).not.toHaveProperty("padIndex");
  });

  test("applies clip-cell selection without creating clips", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];
    const clipCount = Object.keys(core.state.project.clips).length;

    expect(
      applyIntent({ kind: "select-clip-cell", coordinate: { trackIndex: 3, sceneIndex: 7 } }, core.state, hostCommands),
    ).toBe(true);

    expect(core.state.selectedTrackIndex).toBe(3);
    expect(core.state.project.selectedClipCell).toEqual({ trackIndex: 3, sceneIndex: 7 });
    expect(Object.keys(core.state.project.clips)).toHaveLength(clipCount);
    expect(hostCommands).toEqual([]);
  });

  test("applies transport toggle and emits note-off when stopping", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];

    expect(applyIntent({ kind: "toggle-transport" }, core.state, hostCommands)).toBe(true);
    expect(core.state.transport.playing).toBe(true);
    expect(hostCommands).toEqual([]);

    expect(applyIntent({ kind: "toggle-transport" }, core.state, hostCommands)).toBe(true);
    expect(core.state.transport.playing).toBe(false);
    expect(hostCommands).toEqual([{ kind: "track-note-off", trackIndex: 0, note: 60 }]);
  });

  test("applies track selection while preserving the selected scene", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];

    selectClipCell(core.state.project, { trackIndex: 0, sceneIndex: 7 });

    expect(applyIntent({ kind: "select-track", trackIndex: 5 }, core.state, hostCommands)).toBe(true);

    expect(core.state.selectedTrackIndex).toBe(5);
    expect(core.state.visibleTrackBank).toBe(1);
    expect(core.state.project.selectedClipCell).toEqual({ trackIndex: 5, sceneIndex: 7 });
    expect(hostCommands).toEqual([]);
  });

  test("applies step toggles only to the selected clip sequence", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];
    const selectedClip = getSelectedClip(core.state.project);
    const otherClipId = getClipCell(core.state.project, { trackIndex: 1, sceneIndex: 0 }).clipId;
    if (!selectedClip || !otherClipId) throw new Error("Expected default clips");
    const otherClip = core.state.project.clips[otherClipId];

    expect(selectedClip.sequence.steps[1].active).toBe(false);
    expect(otherClip.sequence.steps[1].active).toBe(false);

    expect(applyIntent({ kind: "toggle-step", stepIndex: 1 }, core.state, hostCommands)).toBe(true);

    expect(core.state.selectedStep).toBe(1);
    expect(selectedClip.sequence.steps[1].active).toBe(true);
    expect(otherClip.sequence.steps[1].active).toBe(false);
    expect(hostCommands).toEqual([]);
  });

  test("applies shift state without changing selection or host commands", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];

    expect(applyIntent({ kind: "set-shift-held", held: true }, core.state, hostCommands)).toBe(true);

    expect(core.state.shiftHeld).toBe(true);
    expect(core.state.selectedTrackIndex).toBe(0);
    expect(core.state.project.selectedClipCell).toEqual({ trackIndex: 0, sceneIndex: 0 });
    expect(hostCommands).toEqual([]);
  });

  test("lets domain guards reject invalid track and clip-cell coordinates", () => {
    const core = createOvertureCore();
    const hostCommands: HostCommand[] = [];

    expect(() => applyIntent({ kind: "select-track", trackIndex: 99 }, core.state, hostCommands)).toThrow(
      "Missing track 99",
    );
    expect(() =>
      applyIntent({ kind: "select-clip-cell", coordinate: { trackIndex: 0, sceneIndex: 99 } }, core.state, hostCommands),
    ).toThrow("Missing clip cell 0:99");
    expect(hostCommands).toEqual([]);
  });
});
