import { describe, expect, test } from "vitest";
import { handleDeleteDrumLaneClear } from "@tool-ui/ui_drum_lane_workflows.mjs";

function calls() {
  const log: Array<[string, ...unknown[]]> = [];
  return {
    log,
    fn(name: string) {
      return (...args: unknown[]) => log.push([name, ...args]);
    },
  };
}

function baseState() {
  const drumLaneSteps = [
    Array.from({ length: 32 }, () => new Array(256).fill("1")),
  ];
  return {
    undoAvailable: false,
    redoAvailable: true,
    undoSeqArpSnapshot: { before: true },
    trackActiveClip: [2],
    drumLaneSteps,
    drumLaneHasNotes: [
      Array.from({ length: 32 }, (_, lane) => lane === 3 || lane === 7),
    ],
    drumClipNonEmpty: [
      [false, false, true, false],
    ],
  };
}

describe("drum lane workflows", () => {
  test("Delete+lane clear marks undo, clears only the lane mirror, and preserves non-empty clip state from other lanes", () => {
    const c = calls();
    const S = baseState();

    expect(handleDeleteDrumLaneClear(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 0, 3, {
      markUndo: true,
      popupArgs: ["LANE", "CLEARED"],
    })).toBe(true);

    expect(S.undoAvailable).toBe(true);
    expect(S.redoAvailable).toBe(false);
    expect(S.undoSeqArpSnapshot).toBe(null);
    expect(S.drumLaneSteps[0][3]).toEqual(new Array(256).fill("0"));
    expect(S.drumLaneSteps[0][7][0]).toBe("1");
    expect(S.drumLaneHasNotes[0][3]).toBe(false);
    expect(S.drumClipNonEmpty[0][2]).toBe(true);
    expect(c.log).toEqual([
      ["set", "t0_l3_clear", "1"],
      ["setActive", 0, 3],
      ["popup", "LANE", "CLEARED"],
      ["redraw"],
    ]);
  });

  test("in-line drum-mode Delete clear refreshes lane bank params without changing undo state", () => {
    const c = calls();
    const S = baseState();
    S.drumLaneHasNotes[0][7] = false;

    expect(handleDeleteDrumLaneClear(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 0, 3, {
      refreshBankParams: true,
      popupArgs: ["LANE CLEARED"],
    })).toBe(true);

    expect(S.undoAvailable).toBe(false);
    expect(S.redoAvailable).toBe(true);
    expect(S.undoSeqArpSnapshot).toEqual({ before: true });
    expect(S.drumClipNonEmpty[0][2]).toBe(false);
    expect(c.log).toEqual([
      ["set", "t0_l3_clear", "1"],
      ["setActive", 0, 3],
      ["refresh", 0, 3],
      ["popup", "LANE CLEARED"],
      ["redraw"],
    ]);
  });

  test("Delete+lane clear ignores invalid lane targets", () => {
    const c = calls();
    const S = baseState();

    expect(handleDeleteDrumLaneClear(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 0, -1, {
      markUndo: true,
      refreshBankParams: true,
      popupArgs: ["LANE", "CLEARED"],
    })).toBe(false);

    expect(S.undoAvailable).toBe(false);
    expect(S.drumLaneSteps[0][3][0]).toBe("1");
    expect(c.log).toEqual([]);
  });
});
