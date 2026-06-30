import { describe, expect, test } from "vitest";
import { createInitialControlSurfaceContext } from "../../src/state/control-surface-context";

describe("Overture Next Control Surface Context", () => {
  test("starts in Session View on the first Track and Clip Cell", () => {
    expect(createInitialControlSurfaceContext().snapshot()).toEqual({
      selectedTrackIndex: 0,
      visibleTrackBank: 0,
      activeView: "session",
      heldControls: [],
      selectedStep: 0,
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
    expect(control.snapshot().heldPads).toEqual([
      { padIndex: 7, velocity: 110 },
      { padIndex: 3, velocity: 64 },
    ]);

    control.releasePad(7);
    expect(control.snapshot().heldPads).toEqual([
      { padIndex: 3, velocity: 64 },
    ]);
  });

  test("keeps Track Selection, Selected Clip Cell, and Track Bank aligned", () => {
    const control = createInitialControlSurfaceContext();

    control.selectClipCell({ trackIndex: 6, sceneIndex: 3 });

    expect(control.snapshot()).toMatchObject({
      selectedTrackIndex: 6,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 6, sceneIndex: 3 },
    });
  });

  test("selects a Track while preserving the selected Overture Scene", () => {
    const control = createInitialControlSurfaceContext();

    control.selectClipCell({ trackIndex: 0, sceneIndex: 7 });
    control.selectTrackPreservingScene(5);

    expect(control.snapshot()).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 7 },
    });
  });

  test("updates held physical controls, active view, and selected Step explicitly", () => {
    const control = createInitialControlSurfaceContext();

    control.setSurfaceControlHeld("shift", true);
    expect(control.toggleActiveView()).toBe("track");
    control.selectStep(9);

    expect(control.snapshot()).toMatchObject({
      heldControls: ["shift"],
      activeView: "track",
      selectedStep: 9,
    });

    control.setSurfaceControlHeld("shift", false);
    expect(control.snapshot().heldControls).toEqual([]);
  });

  test("keeps Track View parameter selection per selected page", () => {
    const control = createInitialControlSurfaceContext();

    control.selectTrackViewPage("synth");
    control.selectTrackViewPageParameter("cutoff");
    control.selectTrackViewPage("fx");
    control.selectTrackViewPageParameter("mix");
    control.selectTrackViewPage("synth");

    expect(control.snapshot().trackView).toEqual({
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
    const snapshot = control.snapshot();

    (
      snapshot.trackView.selectedParameterIdByPage as Record<string, string>
    ).default = "mutated";

    expect(control.snapshot().trackView.selectedParameterIdByPage.default).toBe(
      "default",
    );
  });

  test("rejects invalid selected Clip Cell, Step, and Track View page values", () => {
    const control = createInitialControlSurfaceContext();

    expect(() =>
      control.selectClipCell({ trackIndex: 8, sceneIndex: 0 }),
    ).toThrow("Invalid Track Index 8; expected integer from 0 to 7");
    expect(() => control.selectStep(16)).toThrow(
      "Invalid Step Index 16; expected integer from 0 to 15",
    );
    expect(() => control.selectTrackViewPage("")).toThrow(
      "Invalid Root View Page ID; expected non-empty string",
    );
    expect(() => control.selectTrackViewPageParameter("")).toThrow(
      "Invalid Parameter ID; expected non-empty string",
    );
  });
});
