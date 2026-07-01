import { describe, expect, test } from "vitest";
import { clipCellCoordinate } from "../../src/domain/project";
import { createInitialControlSurfaceContext } from "../../src/state/control-surface-context";

const defaultCursor = () =>
  clipCellCoordinate({ trackIndex: 0, sceneIndex: 0 });

describe("Overture Next Control Surface Context", () => {
  test("starts in Session View on the first Track and Clip Cell", () => {
    expect(
      createInitialControlSurfaceContext().snapshot(defaultCursor()),
    ).toEqual({
      selectedTrackIndex: 0,
      visibleTrackBank: 0,
      activeView: "session",
      heldControls: [],
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
      heldPads: [],
      trackView: {
        selectedPageId: "default",
        selectedParameterIdByPage: {
          default: "default",
        },
      },
    });
  });

  test("tracks held pads as transient surface state", () => {
    const control = createInitialControlSurfaceContext();

    control.pressPad(7, 110);
    control.pressPad(3, 64);
    expect(control.snapshot(defaultCursor()).heldPads).toEqual([
      { padIndex: 7, velocity: 110 },
      { padIndex: 3, velocity: 64 },
    ]);

    control.releasePad(7);
    expect(control.snapshot(defaultCursor()).heldPads).toEqual([
      { padIndex: 3, velocity: 64 },
    ]);
  });

  test("updates held physical controls and active view explicitly", () => {
    const control = createInitialControlSurfaceContext();

    control.setSurfaceControlHeld("shift", true);
    expect(control.toggleActiveView()).toBe("track");

    expect(control.snapshot(defaultCursor())).toMatchObject({
      heldControls: ["shift"],
      activeView: "track",
    });

    control.setSurfaceControlHeld("shift", false);
    expect(control.snapshot(defaultCursor()).heldControls).toEqual([]);
  });

  test("keeps Track View parameter selection per selected page", () => {
    const control = createInitialControlSurfaceContext();

    control.selectTrackViewPage("synth");
    control.selectTrackViewPageParameter("cutoff");
    control.selectTrackViewPage("fx");
    control.selectTrackViewPageParameter("mix");
    control.selectTrackViewPage("synth");

    expect(control.snapshot(defaultCursor()).trackView).toEqual({
      selectedPageId: "synth",
      selectedParameterIdByPage: {
        default: "default",
        synth: "cutoff",
        fx: "mix",
      },
    });
  });

  test("copies Track View page context into snapshots", () => {
    const control = createInitialControlSurfaceContext();
    const snapshot = control.snapshot(defaultCursor());

    (
      snapshot.trackView.selectedParameterIdByPage as Record<string, string>
    ).default = "mutated";

    expect(
      control.snapshot(defaultCursor()).trackView.selectedParameterIdByPage
        .default,
    ).toBe("default");
  });

  test("rejects invalid Track View page values", () => {
    const control = createInitialControlSurfaceContext();

    expect(() => control.selectTrackViewPage("")).toThrow(
      "Invalid Root View Page ID; expected non-empty string",
    );
    expect(() => control.selectTrackViewPageParameter("")).toThrow(
      "Invalid Parameter ID; expected non-empty string",
    );
  });
});
