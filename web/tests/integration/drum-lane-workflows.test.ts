import { describe, expect, test } from "vitest";
import {
  handleDeleteDrumLaneClear,
  handleDrumLaneCopyPaste,
  handleDrumLaneMuteSolo,
} from "@tool-ui/ui_drum_lane_workflows.mjs";

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

  test("Mute+lane toggles lane mute and marks Mute as a consumed modifier", () => {
    const c = calls();
    const S = {
      muteUsedAsModifier: false,
      shiftHeld: false,
      drumLaneMute: [0],
      drumLaneSolo: [0],
    };

    expect(handleDrumLaneMuteSolo(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 4)).toBe(true);

    expect(S.muteUsedAsModifier).toBe(true);
    expect(S.drumLaneMute[0]).toBe(1 << 4);
    expect(S.drumLaneSolo[0]).toBe(0);
    expect(c.log).toEqual([
      ["set", "t0_l4_mute", "1"],
      ["redraw"],
    ]);

    c.log.length = 0;
    expect(handleDrumLaneMuteSolo(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 4)).toBe(true);

    expect(S.drumLaneMute[0]).toBe(0);
    expect(c.log).toEqual([
      ["set", "t0_l4_mute", "0"],
      ["redraw"],
    ]);
  });

  test("Mute+lane clears an existing solo before muting the lane", () => {
    const c = calls();
    const S = {
      muteUsedAsModifier: false,
      shiftHeld: false,
      drumLaneMute: [0],
      drumLaneSolo: [1 << 5],
    };

    expect(handleDrumLaneMuteSolo(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 5)).toBe(true);

    expect(S.drumLaneMute[0]).toBe(1 << 5);
    expect(S.drumLaneSolo[0]).toBe(0);
    expect(c.log).toEqual([
      ["set", "t0_l5_solo", "0"],
      ["set", "t0_l5_mute", "1"],
      ["redraw"],
    ]);
  });

  test("Shift+Mute+lane toggles lane solo and clears an existing mute", () => {
    const c = calls();
    const S = {
      muteUsedAsModifier: false,
      shiftHeld: true,
      drumLaneMute: [1 << 6],
      drumLaneSolo: [0],
    };

    expect(handleDrumLaneMuteSolo(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 6)).toBe(true);

    expect(S.muteUsedAsModifier).toBe(true);
    expect(S.drumLaneMute[0]).toBe(0);
    expect(S.drumLaneSolo[0]).toBe(1 << 6);
    expect(c.log).toEqual([
      ["set", "t0_l6_mute", "0"],
      ["set", "t0_l6_solo", "1"],
      ["redraw"],
    ]);

    c.log.length = 0;
    expect(handleDrumLaneMuteSolo(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 6)).toBe(true);

    expect(S.drumLaneSolo[0]).toBe(0);
    expect(c.log).toEqual([
      ["set", "t0_l6_solo", "0"],
      ["redraw"],
    ]);
  });

  test("Mute/Solo lane workflow ignores invalid lane targets", () => {
    const c = calls();
    const S = {
      muteUsedAsModifier: false,
      shiftHeld: true,
      drumLaneMute: [0],
      drumLaneSolo: [0],
    };

    expect(handleDrumLaneMuteSolo(S, {
      DRUM_LANES: 32,
      host_module_set_param: c.fn("set"),
      forceRedraw: c.fn("redraw"),
    }, 0, 32)).toBe(false);

    expect(S.muteUsedAsModifier).toBe(false);
    expect(S.drumLaneMute[0]).toBe(0);
    expect(S.drumLaneSolo[0]).toBe(0);
    expect(c.log).toEqual([]);
  });

  test("Copy+lane arms a drum lane copy source", () => {
    const c = calls();
    const S = {
      copySrc: null,
      shiftHeld: false,
    };

    expect(handleDrumLaneCopyPaste(S, {
      DRUM_LANES: 32,
      copyDrumLane: c.fn("copy"),
      cutDrumLane: c.fn("cut"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      invalidateLEDCache: c.fn("invalidate"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 2, 9)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "drum_lane", track: 2, lane: 9 });
    expect(c.log).toEqual([
      ["invalidate"],
      ["popup", "COPIED"],
    ]);
  });

  test("Shift+Copy+lane arms a drum lane cut source", () => {
    const c = calls();
    const S = {
      copySrc: null,
      shiftHeld: true,
    };

    expect(handleDrumLaneCopyPaste(S, {
      DRUM_LANES: 32,
      copyDrumLane: c.fn("copy"),
      cutDrumLane: c.fn("cut"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      invalidateLEDCache: c.fn("invalidate"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 2, 9)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "cut_drum_lane", track: 2, lane: 9 });
    expect(c.log).toEqual([
      ["invalidate"],
      ["popup", "CUT"],
    ]);
  });

  test("Copy+lane paste copies within the same track and selects the destination lane", () => {
    const c = calls();
    const S = {
      copySrc: { kind: "drum_lane", track: 2, lane: 4 },
      shiftHeld: false,
    };

    expect(handleDrumLaneCopyPaste(S, {
      DRUM_LANES: 32,
      copyDrumLane: c.fn("copy"),
      cutDrumLane: c.fn("cut"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      invalidateLEDCache: c.fn("invalidate"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 2, 11)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "drum_lane", track: 2, lane: 4 });
    expect(c.log).toEqual([
      ["copy", 2, 4, 11],
      ["setActive", 2, 11],
      ["refresh", 2, 11],
      ["invalidate"],
      ["redraw"],
      ["popup", "PASTED"],
    ]);
  });

  test("Cut+lane paste cuts within the same track and converts the source to copied destination", () => {
    const c = calls();
    const S = {
      copySrc: { kind: "cut_drum_lane", track: 2, lane: 4 },
      shiftHeld: true,
    };

    expect(handleDrumLaneCopyPaste(S, {
      DRUM_LANES: 32,
      copyDrumLane: c.fn("copy"),
      cutDrumLane: c.fn("cut"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      invalidateLEDCache: c.fn("invalidate"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 2, 11)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "drum_lane", track: 2, lane: 11 });
    expect(c.log).toEqual([
      ["cut", 2, 4, 11],
      ["setActive", 2, 11],
      ["refresh", 2, 11],
      ["invalidate"],
      ["redraw"],
      ["popup", "PASTED"],
    ]);
  });

  test("Copy+lane swallows unrelated or cross-track copy sources", () => {
    const c = calls();
    const S = {
      copySrc: { kind: "drum_lane", track: 1, lane: 4 },
      shiftHeld: false,
    };

    expect(handleDrumLaneCopyPaste(S, {
      DRUM_LANES: 32,
      copyDrumLane: c.fn("copy"),
      cutDrumLane: c.fn("cut"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      invalidateLEDCache: c.fn("invalidate"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 2, 11)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "drum_lane", track: 1, lane: 4 });
    expect(c.log).toEqual([]);

    S.copySrc = { kind: "step", absStep: 3 };
    expect(handleDrumLaneCopyPaste(S, {
      DRUM_LANES: 32,
      copyDrumLane: c.fn("copy"),
      cutDrumLane: c.fn("cut"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      invalidateLEDCache: c.fn("invalidate"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 2, 11)).toBe(true);

    expect(S.copySrc).toEqual({ kind: "step", absStep: 3 });
    expect(c.log).toEqual([]);
  });

  test("Copy+lane ignores invalid lane targets", () => {
    const c = calls();
    const S = {
      copySrc: null,
      shiftHeld: false,
    };

    expect(handleDrumLaneCopyPaste(S, {
      DRUM_LANES: 32,
      copyDrumLane: c.fn("copy"),
      cutDrumLane: c.fn("cut"),
      setActiveDrumLane: c.fn("setActive"),
      refreshDrumLaneBankParams: c.fn("refresh"),
      invalidateLEDCache: c.fn("invalidate"),
      showActionPopup: c.fn("popup"),
      forceRedraw: c.fn("redraw"),
    }, 2, -1)).toBe(false);

    expect(S.copySrc).toBe(null);
    expect(c.log).toEqual([]);
  });
});
