import { describe, expect, test } from "vitest";
import { auditionNote } from "../../../src/application/operations";
import { createInitialControlSurfaceContext } from "../../../src/state/control-surface-context";
import { createDefaultProject } from "../../../src/state/project";

describe("Overture Next audition note operation", () => {
  test("holds the pad and emits a note-on while pressed", () => {
    const control = createInitialControlSurfaceContext();
    const project = createDefaultProject();

    const result = auditionNote(
      { control, project },
      { held: true, padIndex: 5, note: 65, trackIndex: 0, velocity: 100 },
    );

    expect(control.snapshot().heldPads).toEqual([
      { padIndex: 5, velocity: 100 },
    ]);
    expect(result.hostCommands).toEqual([
      {
        kind: "track-note-on",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 65,
        velocity: 100,
      },
    ]);
  });

  test("releases the pad and emits a note-off on release", () => {
    const control = createInitialControlSurfaceContext();
    const project = createDefaultProject();

    auditionNote(
      { control, project },
      { held: true, padIndex: 5, note: 65, trackIndex: 0, velocity: 100 },
    );
    const result = auditionNote(
      { control, project },
      { held: false, padIndex: 5, note: 65, trackIndex: 0, velocity: 0 },
    );

    expect(control.snapshot().heldPads).toEqual([]);
    expect(result.hostCommands).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 65,
      },
    ]);
  });
});
