import { describe, expect, test } from "vitest";
import {
  readMelodicClipFromDsp,
  readTargetedClipAutomationFromDsp,
  readTargetedClipRestorePairFromDsp,
} from "@tool-ui/ui_clip_track_sync.mjs";

function createState() {
  return {
    trackActiveClip: [2, 0],
    activeDrumLane: [5, 6],
    clipSteps: Array.from({ length: 2 }, () => Array.from({ length: 4 }, () => new Array(8).fill(9))),
    clipNonEmpty: Array.from({ length: 2 }, () => new Array(4).fill(false)),
    clipLength: Array.from({ length: 2 }, () => new Array(4).fill(16)),
    clipTPS: Array.from({ length: 2 }, () => new Array(4).fill(24)),
    trackCCAutoBits: Array.from({ length: 2 }, () => new Array(4).fill(99)),
    clipCCVal: Array.from({ length: 2 }, () => Array.from({ length: 4 }, () => new Array(8).fill(99))),
    clipAtHas: Array.from({ length: 2 }, () => new Array(4).fill(false)),
  };
}

describe("Track / Clip Sync melodic readback", () => {
  test("updates steps, content, length, and TPS with deferred-readback inactive step mapping", () => {
    const S = createState();
    const reads: string[] = [];
    const params = new Map<string, string>([
      ["t0_c2_steps", "12000000"],
      ["t0_c2_length", "32"],
      ["t0_c2_tps", "12"],
    ]);

    readMelodicClipFromDsp(S, {
      NUM_STEPS: 8,
      TPS_VALUES: [6, 12, 24],
      host_module_get_param: (key: string) => {
        reads.push(key);
        return params.get(key) ?? null;
      },
      clipHasContent: (track: number, clip: number) => S.clipSteps[track][clip].some((v: number) => v !== 0),
      refreshPerClipBankParams: () => {
        throw new Error("inactive refresh should not run");
      },
    }, 0, 2, {
      preserveInactiveSteps: true,
      refreshActiveBankParams: false,
    });

    expect(S.clipSteps[0][2].slice(0, 4)).toEqual([1, 2, 0, 0]);
    expect(S.clipNonEmpty[0][2]).toBe(true);
    expect(S.clipLength[0][2]).toBe(32);
    expect(S.clipTPS[0][2]).toBe(12);
    expect(reads).toEqual(["t0_c2_steps", "t0_c2_length", "t0_c2_tps"]);
  });

  test("preserves targeted-sync mapping, TPS fallback, and active-clip bank refresh", () => {
    const S = createState();
    const calls: Array<[string, ...unknown[]]> = [];
    const params = new Map<string, string>([
      ["t0_c2_steps", "12000000"],
      ["t0_c2_length", "bad"],
      ["t0_c2_tps", "99"],
    ]);

    readMelodicClipFromDsp(S, {
      NUM_STEPS: 8,
      TPS_VALUES: [6, 12, 24],
      host_module_get_param: (key: string) => {
        calls.push(["get", key]);
        return params.get(key) ?? null;
      },
      clipHasContent: (track: number, clip: number) => S.clipSteps[track][clip].some((v: number) => v !== 0),
      refreshPerClipBankParams: (track: number) => calls.push(["refreshPerClipBankParams", track]),
    }, 0, 2, {
      preserveInactiveSteps: false,
      refreshActiveBankParams: true,
    });

    expect(S.clipSteps[0][2].slice(0, 4)).toEqual([1, 0, 0, 0]);
    expect(S.clipNonEmpty[0][2]).toBe(true);
    expect(S.clipLength[0][2]).toBe(16);
    expect(S.clipTPS[0][2]).toBe(24);
    expect(calls).toEqual([
      ["get", "t0_c2_steps"],
      ["get", "t0_c2_length"],
      ["get", "t0_c2_tps"],
      ["refreshPerClipBankParams", 0],
    ]);
  });

  test("targeted automation readback preserves CC and aftertouch read ordering", () => {
    const S = createState();
    const calls: Array<[string, string]> = [];
    const params = new Map<string, string>([
      ["t1_c3_cc_auto_bits", "5"],
      ["t1_c3_cc_rest", "0 64 127 128 255 -1 bad 7"],
      ["t1_c3_at_has", "1"],
    ]);

    readTargetedClipAutomationFromDsp(S, {
      host_module_get_param: (key: string) => {
        calls.push(["get", key]);
        return params.get(key) ?? null;
      },
    }, 1, 3);

    expect(S.trackCCAutoBits[1][3]).toBe(5);
    expect(S.clipCCVal[1][3]).toEqual([0, 64, 127, -1, -1, -1, -1, 7]);
    expect(S.clipAtHas[1][3]).toBe(true);
    expect(calls).toEqual([
      ["get", "t1_c3_cc_auto_bits"],
      ["get", "t1_c3_cc_rest"],
      ["get", "t1_c3_at_has"],
    ]);
  });

  test("targeted automation readback preserves null and missing-rest fallback behavior", () => {
    const S = createState();
    S.clipCCVal[0][1] = [1, 2, 3, 4, 5, 6, 7, 8];
    S.clipAtHas[0][1] = true;

    readTargetedClipAutomationFromDsp(S, {
      host_module_get_param: (key: string) =>
        key === "t0_c1_cc_auto_bits" ? null : key === "t0_c1_cc_rest" ? "" : null,
    }, 0, 1);

    expect(S.trackCCAutoBits[0][1]).toBe(0);
    expect(S.clipCCVal[0][1]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(S.clipAtHas[0][1]).toBe(false);
  });

  test("targeted restore pair preserves melodic clip then automation ordering", () => {
    const S = createState();
    const calls: Array<[string, ...unknown[]]> = [];
    const params = new Map<string, string>([
      ["t0_c2_steps", "10000000"],
      ["t0_c2_length", "48"],
      ["t0_c2_tps", "6"],
      ["t0_c2_cc_auto_bits", "3"],
      ["t0_c2_cc_rest", "1 2 3 4 5 6 7 8"],
      ["t0_c2_at_has", "1"],
    ]);

    readTargetedClipRestorePairFromDsp(S, {
      NUM_STEPS: 8,
      TPS_VALUES: [6, 12, 24],
      host_module_get_param: (key: string) => {
        calls.push(["get", key]);
        return params.get(key) ?? null;
      },
      clipHasContent: (track: number, clip: number) => S.clipSteps[track][clip].some((v: number) => v !== 0),
      refreshPerClipBankParams: (track: number) => calls.push(["refreshPerClipBankParams", track]),
    }, 0, 2, false);

    expect(S.clipSteps[0][2][0]).toBe(1);
    expect(S.clipLength[0][2]).toBe(48);
    expect(S.clipTPS[0][2]).toBe(6);
    expect(S.trackCCAutoBits[0][2]).toBe(3);
    expect(S.clipCCVal[0][2]).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(S.clipAtHas[0][2]).toBe(true);
    expect(calls).toEqual([
      ["get", "t0_c2_steps"],
      ["get", "t0_c2_length"],
      ["get", "t0_c2_tps"],
      ["refreshPerClipBankParams", 0],
      ["get", "t0_c2_cc_auto_bits"],
      ["get", "t0_c2_cc_rest"],
      ["get", "t0_c2_at_has"],
    ]);
  });

  test("targeted restore pair preserves drum content, lane, bank, then automation ordering", () => {
    const S = createState();
    const calls: Array<[string, ...unknown[]]> = [];
    const params = new Map<string, string>([
      ["t1_c3_cc_auto_bits", "11"],
      ["t1_c3_cc_rest", "8 7 6 5 4 3 2 1"],
      ["t1_c3_at_has", "0"],
    ]);

    readTargetedClipRestorePairFromDsp(S, {
      host_module_get_param: (key: string) => {
        calls.push(["get", key]);
        return params.get(key) ?? null;
      },
      syncDrumClipContent: (track: number) => calls.push(["syncDrumClipContent", track]),
      syncDrumLanesMeta: (track: number) => calls.push(["syncDrumLanesMeta", track]),
      syncDrumLaneSteps: (track: number, lane: number) => calls.push(["syncDrumLaneSteps", track, lane]),
      refreshDrumLaneBankParams: (track: number, lane: number) => calls.push(["refreshDrumLaneBankParams", track, lane]),
    }, 1, 3, true);

    expect(S.trackCCAutoBits[1][3]).toBe(11);
    expect(S.clipCCVal[1][3]).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
    expect(S.clipAtHas[1][3]).toBe(false);
    expect(calls).toEqual([
      ["syncDrumClipContent", 1],
      ["syncDrumLanesMeta", 1],
      ["syncDrumLaneSteps", 1, 6],
      ["refreshDrumLaneBankParams", 1, 6],
      ["get", "t1_c3_cc_auto_bits"],
      ["get", "t1_c3_cc_rest"],
      ["get", "t1_c3_at_has"],
    ]);
  });
});
