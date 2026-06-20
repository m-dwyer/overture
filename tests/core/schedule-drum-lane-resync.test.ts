import { describe, test, expect } from "vitest";
import { scheduleDrumLaneResync } from "@overture-ui/core/ui_state.mjs";

/* Characterizes the shared scheduler that replaces the open-coded triple
 * `S.pendingDrumLaneResync = N; S.pendingDrumLaneResyncTrack = T;
 *  S.pendingDrumLaneResyncLane = L` at ~9 call sites. Pure state mutation,
 * consumed later by the tick-task that decrements the counter. */
describe("scheduleDrumLaneResync", () => {
  test("writes counter, track, and lane onto S (ticks=2 variant)", () => {
    const S = { pendingDrumLaneResync: 0, pendingDrumLaneResyncTrack: -1, pendingDrumLaneResyncLane: -1 };
    scheduleDrumLaneResync(S, 3, 7, 2);
    expect(S.pendingDrumLaneResync).toBe(2);
    expect(S.pendingDrumLaneResyncTrack).toBe(3);
    expect(S.pendingDrumLaneResyncLane).toBe(7);
  });

  test("supports the ticks=3 variant (recording / track-view reassign)", () => {
    const S = { pendingDrumLaneResync: 0, pendingDrumLaneResyncTrack: -1, pendingDrumLaneResyncLane: -1 };
    scheduleDrumLaneResync(S, 0, 4, 3);
    expect(S.pendingDrumLaneResync).toBe(3);
    expect(S.pendingDrumLaneResyncTrack).toBe(0);
    expect(S.pendingDrumLaneResyncLane).toBe(4);
  });

  test("overwrites any pending schedule (last write wins, like the open-coded sites)", () => {
    const S = { pendingDrumLaneResync: 2, pendingDrumLaneResyncTrack: 1, pendingDrumLaneResyncLane: 5 };
    scheduleDrumLaneResync(S, 2, 6, 3);
    expect(S.pendingDrumLaneResync).toBe(3);
    expect(S.pendingDrumLaneResyncTrack).toBe(2);
    expect(S.pendingDrumLaneResyncLane).toBe(6);
  });
});
