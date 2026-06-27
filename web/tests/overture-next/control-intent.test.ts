import { describe, expect, test } from "vitest";
import { interpretControl } from "../../../overture-next/src/core/controls/interpret-control";
import { applyIntent } from "../../../overture-next/src/core/intents/apply-intent";
import { createOvertureCore } from "../../../overture-next/src/core/core";
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
});
