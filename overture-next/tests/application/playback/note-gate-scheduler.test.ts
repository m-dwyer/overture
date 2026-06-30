import { describe, expect, test } from "vitest";
import { createNoteGateScheduler } from "../../../src/application/playback/internal/note-gate-scheduler";

describe("Note gate scheduler", () => {
  test("drains due note-offs while preserving future gates", () => {
    const scheduler = createNoteGateScheduler();

    scheduler.schedule({
      dueTick: 12,
      emittedTarget: { kind: "move", moveTrackTarget: 1 },
      trackIndex: 1,
      note: 60,
    });
    scheduler.schedule({
      dueTick: 24,
      emittedTarget: { kind: "schwung", schwungChainIndex: 0 },
      trackIndex: 4,
      note: 64,
    });

    expect(scheduler.drainDue(11)).toEqual([]);
    expect(scheduler.drainDue(12)).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 1 },
        trackIndex: 1,
        note: 60,
      },
    ]);
    expect(scheduler.drainDue(24)).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "schwung", schwungChainIndex: 0 },
        trackIndex: 4,
        note: 64,
      },
    ]);
  });

  test("reports sounding notes without draining them", () => {
    const scheduler = createNoteGateScheduler();

    scheduler.schedule({
      dueTick: 12,
      emittedTarget: { kind: "move", moveTrackTarget: 1 },
      trackIndex: 1,
      note: 60,
    });
    scheduler.schedule({
      dueTick: 24,
      emittedTarget: { kind: "schwung", schwungChainIndex: 0 },
      trackIndex: 4,
      note: 64,
    });

    expect(scheduler.activeNotes()).toEqual([
      { trackIndex: 1, note: 60 },
      { trackIndex: 4, note: 64 },
    ]);

    scheduler.drainDue(12);

    expect(scheduler.activeNotes()).toEqual([{ trackIndex: 4, note: 64 }]);
  });

  test("drains only one Track without disturbing other pending note-offs", () => {
    const scheduler = createNoteGateScheduler();

    scheduler.schedule({
      dueTick: 12,
      emittedTarget: { kind: "move", moveTrackTarget: 0 },
      trackIndex: 0,
      note: 60,
    });
    scheduler.schedule({
      dueTick: 12,
      emittedTarget: { kind: "move", moveTrackTarget: 1 },
      trackIndex: 1,
      note: 61,
    });

    expect(scheduler.drainTrack(0)).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 0 },
        trackIndex: 0,
        note: 60,
      },
    ]);
    expect(scheduler.drainDue(12)).toEqual([
      {
        kind: "track-note-off",
        route: { kind: "move", moveTrackTarget: 1 },
        trackIndex: 1,
        note: 61,
      },
    ]);
  });
});
