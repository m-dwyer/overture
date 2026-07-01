import { describe, expect, test } from "vitest";
import { CLIP_CELL_COUNT, SCENE_COUNT } from "../../src/domain/project";
import { createInitialControlSurfaceContext } from "../../src/state/control-surface-context";
import { createDefaultProject } from "../../src/state/project";
import { visibleTrackRowsForBank } from "../../src/state/surface-addressing";

describe("Overture Next Project", () => {
  test("keeps Track Selection, Selected Clip Cell, and Track Bank aligned", () => {
    const project = createDefaultProject();
    const control = createInitialControlSurfaceContext();

    project.selectClip({ trackIndex: 6, sceneIndex: 3 });

    expect(project.selectedClipCell()).toEqual({
      trackIndex: 6,
      sceneIndex: 3,
    });
    expect(control.snapshot(project.selectedClipCell())).toMatchObject({
      selectedTrackIndex: 6,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 6, sceneIndex: 3 },
    });
  });

  test("selects a Track while preserving the selected Overture Scene", () => {
    const project = createDefaultProject();
    const control = createInitialControlSurfaceContext();

    project.selectClip({ trackIndex: 0, sceneIndex: 7 });
    project.selectTrackKeepingScene(5);

    expect(project.selectedClipCell()).toEqual({
      trackIndex: 5,
      sceneIndex: 7,
    });
    expect(control.snapshot(project.selectedClipCell())).toMatchObject({
      selectedTrackIndex: 5,
      visibleTrackBank: 1,
      selectedClipCell: { trackIndex: 5, sceneIndex: 7 },
    });
  });

  test("rejects invalid selected Clip Cell values", () => {
    const project = createDefaultProject();

    expect(() => project.selectClip({ trackIndex: 8, sceneIndex: 0 })).toThrow(
      "Invalid Track Index 8; expected integer from 0 to 7",
    );
  });

  test("creates structural scenes, tracks, and clip cells through the public Project API", () => {
    const project = createDefaultProject();

    const cells = project.clipCellSnapshots();
    expect(cells).toHaveLength(CLIP_CELL_COUNT);
    expect(new Set(cells.map((cell) => cell.sceneIndex)).size).toBe(
      SCENE_COUNT,
    );
    expect(project.clipCellAt({ trackIndex: 0, sceneIndex: 0 })).toMatchObject({
      trackIndex: 0,
      sceneIndex: 0,
      clipId: "clip-1",
    });
    expect(project.clipFor({ trackIndex: 0, sceneIndex: 0 })?.id).toBe(
      "clip-1",
    );
  });

  test("resolves track-bank rows and route data without exposing Project internals", () => {
    const project = createDefaultProject();

    expect(visibleTrackRowsForBank(1)).toEqual([4, 5, 6, 7]);
    expect(project.trackRoute(4)).toEqual({
      kind: "schwung",
      schwungChainIndex: 0,
    });
  });

  test("exposes each Track's Colour identity, defaulted per Track", () => {
    const project = createDefaultProject();

    expect(project.trackColours()).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });

  test("returns copied clip, Clip Cell, and route read models instead of Project-owned state", () => {
    const project = createDefaultProject();
    const clip = project.clipFor({ trackIndex: 0, sceneIndex: 0 });
    const cell = project.clipCellAt({ trackIndex: 0, sceneIndex: 0 });
    const cells = project.clipCellSnapshots();
    const route = project.trackRoute(4);
    if (!clip || route.kind !== "schwung")
      throw new Error("Expected default clip and Schwung route");

    (clip.sequence.steps as unknown as Array<{ active: boolean }>)[1].active =
      true;
    (cell as { clipId: string | null }).clipId = "mutated";
    (cells as Array<{ clipId: string | null }>)[0].clipId = "mutated";
    route.schwungChainIndex = 99;

    expect(
      project.clipFor({ trackIndex: 0, sceneIndex: 0 })?.sequence.steps[1]
        .active,
    ).toBe(false);
    expect(project.clipCellAt({ trackIndex: 0, sceneIndex: 0 }).clipId).toBe(
      "clip-1",
    );
    expect(project.clipCellSnapshots()[0]?.clipId).toBe("clip-1");
    expect(project.trackRoute(4)).toEqual({
      kind: "schwung",
      schwungChainIndex: 0,
    });
  });
});
