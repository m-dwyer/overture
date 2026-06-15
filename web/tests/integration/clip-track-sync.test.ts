import { describe, expect, test } from "vitest";
import { readMelodicClipFromDsp } from "@tool-ui/ui_clip_track_sync.mjs";

function createState() {
  return {
    trackActiveClip: [2, 0],
    clipSteps: Array.from({ length: 2 }, () => Array.from({ length: 4 }, () => new Array(8).fill(9))),
    clipNonEmpty: Array.from({ length: 2 }, () => new Array(4).fill(false)),
    clipLength: Array.from({ length: 2 }, () => new Array(4).fill(16)),
    clipTPS: Array.from({ length: 2 }, () => new Array(4).fill(24)),
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
});
