import { describe, expect, test } from "vitest";
import {
  clipCellCoordinate,
  clipId,
  parseSceneIndex,
  parseTrackIndex,
  sceneIndex,
  trackIndex,
} from "../../src/domain/project";

describe("Project value objects", () => {
  test("brands valid Project indexes, Clip IDs, and Clip Cell Coordinates", () => {
    expect(trackIndex(0)).toBe(0);
    expect(sceneIndex(7)).toBe(7);
    expect(clipId("clip-1")).toBe("clip-1");
    expect(clipCellCoordinate({ trackIndex: 3, sceneIndex: 2 })).toEqual({
      trackIndex: 3,
      sceneIndex: 2,
    });
  });

  test("parses invalid Track and Scene Indexes as null", () => {
    expect(parseTrackIndex(99)).toBeNull();
    expect(parseSceneIndex(-1)).toBeNull();
  });

  test("rejects invalid Project value objects with domain-specific messages", () => {
    expect(() => trackIndex(8)).toThrow(
      "Invalid Track Index 8; expected integer from 0 to 7",
    );
    expect(() => sceneIndex(8)).toThrow(
      "Invalid Scene Index 8; expected integer from 0 to 7",
    );
    expect(() => clipCellCoordinate({ trackIndex: 1, sceneIndex: 8 })).toThrow(
      "Invalid Scene Index 8; expected integer from 0 to 7",
    );
    expect(() => clipId("")).toThrow(
      "Invalid Clip ID; expected non-empty string",
    );
  });
});
