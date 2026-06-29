import { describe, expect, test } from "vitest";
import { CLIP_CELL_COUNT, SCENE_COUNT } from "../../src/domain/project";
import { createDefaultProject } from "../../src/state/project";
import { visibleTrackRowsForBank } from "../../src/state/surface-addressing";

describe("Overture Next Project", () => {
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
