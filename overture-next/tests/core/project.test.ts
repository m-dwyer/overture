import { describe, expect, test } from "vitest";
import {
  CLIP_CELL_COUNT,
  SCENE_COUNT,
  createDefaultProject,
  getClipCell,
  getClipForCell,
  getProjectTrackRoute,
  listClipCellSnapshots,
  visibleTrackRowsForBank,
} from "../../src/core/project";

describe("Overture Next Project", () => {
  test("creates structural scenes, tracks, and clip cells through the public Project API", () => {
    const project = createDefaultProject();

    expect(project.scenes).toHaveLength(SCENE_COUNT);
    expect(project.clipCells).toHaveLength(CLIP_CELL_COUNT);
    expect(getClipCell(project, { trackIndex: 0, sceneIndex: 0 })).toMatchObject({
      trackIndex: 0,
      sceneIndex: 0,
      clipId: "clip-1",
    });
    expect(getClipForCell(project, { trackIndex: 0, sceneIndex: 0 })?.id).toBe("clip-1");
    expect(listClipCellSnapshots(project)).toHaveLength(CLIP_CELL_COUNT);
  });

  test("resolves track-bank rows and route data without exposing Project internals", () => {
    const project = createDefaultProject();

    expect(visibleTrackRowsForBank(1)).toEqual([4, 5, 6, 7]);
    expect(getProjectTrackRoute(project, 4)).toEqual({ kind: "schwung", schwungChainIndex: 0 });
  });
});
