import { describe, expect, test } from "vitest";
import { createCoreOwners } from "../../src/application/core-owners";
import {
  buildCoreSnapshot,
  selectedSequenceLength,
} from "../../src/application/core-read-model";
import { DEFAULT_STEP_COUNT } from "../../src/domain/sequence";

describe("Overture Next core read model", () => {
  test("projects selected clip, playback focus, and step state from core owners", () => {
    const owners = createCoreOwners();
    owners.control.selectStep(4);
    owners.transport.seekToStep(4);

    const snapshot = buildCoreSnapshot(owners);

    expect(snapshot).toMatchObject({
      selectedTrackIndex: 0,
      selectedClipCell: { trackIndex: 0, sceneIndex: 0 },
      selectedClipId: "clip-1",
      selectedStep: 4,
      playing: false,
    });
    expect(
      snapshot.playbackTracks?.map((track) => track.playingClipId),
    ).toEqual([
      "clip-1",
      "clip-2",
      "clip-3",
      "clip-4",
      "clip-5",
      "clip-6",
      "clip-7",
      "clip-8",
    ]);
    expect(snapshot.steps[4]).toMatchObject({
      index: 4,
      active: true,
      note: 64,
      velocity: 100,
      selected: true,
      playhead: true,
    });
  });

  test("uses default inactive steps for an empty selected Clip Cell", () => {
    const owners = createCoreOwners();
    owners.control.selectClipCell({ trackIndex: 0, sceneIndex: 7 });

    const snapshot = buildCoreSnapshot(owners);

    expect(snapshot.selectedClipId).toBeNull();
    expect(selectedSequenceLength(owners)).toBe(DEFAULT_STEP_COUNT);
    expect(snapshot.steps).toHaveLength(DEFAULT_STEP_COUNT);
    expect(snapshot.steps[0]).toMatchObject({
      active: false,
      note: null,
      velocity: null,
      selected: true,
      playhead: true,
    });
  });
});
