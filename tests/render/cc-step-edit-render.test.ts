import { beforeEach, describe, expect, test } from "vitest";
import { S } from "@overture-ui/core/ui_state.mjs";
import { renderCcStepEditView } from "@overture-ui/render/ui_cc_step_edit_render.mjs";

type DrawCall = [string, ...unknown[]];

function createDeps(calls: DrawCall[], values: Record<string, string | null> = {}) {
  const getCalls: string[] = [];
  return {
    deps: {
      print: (x: number, y: number, text: string, color: number) => calls.push(["print", x, y, text, color]),
      pixelPrint: (x: number, y: number, text: string, color: number) => calls.push(["pixel", x, y, text, color]),
      fill_rect: (x: number, y: number, w: number, h: number, color: number) => calls.push(["fill", x, y, w, h, color]),
      host_module_get_param: (key: string) => {
        getCalls.push(key);
        return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
      },
    },
    getCalls,
  };
}

function printedTexts(calls: DrawCall[]) {
  return calls
    .filter((call) => call[0] === "print" || call[0] === "pixel")
    .map((call) => String(call[3]));
}

// Compact, one-line-per-call serialization of the full draw sequence — keeps
// the pixel-level pin (every fill/print, in order) reviewable in a diff.
function fmtSeq(calls: DrawCall[]) {
  return calls
    .map((c) => c[0] + " " + c.slice(1).map((v) => (typeof v === "string" ? `'${v}'` : String(v))).join(","))
    .join("\n");
}

describe("CC step edit presentation", () => {
  beforeEach(() => {
    S.activeTrack = 0;
    S.trackActiveClip = [1];
    S.trackQueuedClip = [-1];
    S.trackWillRelaunch = [false];
    S.heldStep = 3;
    S.tickCount = 1;
    S.knobTouched = -1;
    S.playing = false;
    S.masterPos = 0;
    S.trackCurrentPage = [1];
    S.clipLength = [[16, 20]];
    S.clipTPS = [[24, 24]];
    S.ccActiveLane = [2];
    S.ccLaneLength = [[[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 20, 0, 0, 0, 0, 0]]];
    S.ccLaneTps = [[[0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 12, 0, 0, 0, 0, 0]]];
    S.trackCCType = [[1, 0, 2, 0, 0, 0, 0, 0]];
    S.trackCCAssign = [[7, 74, 5, -1, 72, 91, 93, 10]];
    S.schLabel = [[null, null, "Cutoff", null, null, null, null, null]];
    S.ccStepEditSet = [false, false, true, false, false, false, false, false];
    S.ccStepEditVal = [0, 0, 100, 0, 0, 0, 0, 0];
    S.ccStepEditComputed = [64, -1, 99, -1, 127, 0, 32, -1];
    S.ccGraphOvData = [];
    S.ccGraphOvKey = "";
  });

  test("renders graph, scheduler header, knob cells, and current page", () => {
    const calls: DrawCall[] = [];
    const { deps, getCalls } = createDeps(calls, {
      t0_c1_ccsv_2_0: "0 8 16 24 32 40 48 56 64 72 80 88 96 104 112 120",
      t0_c1_ccsv_2_1: "127 96 64 32",
    });

    renderCcStepEditView(deps);

    expect(getCalls).toEqual(["t0_c1_ccsv_2_0", "t0_c1_ccsv_2_1"]);
    expect(S.ccGraphOvKey).toBe("sg_0_1_2");
    expect(S.ccGraphOvData).toEqual([
      0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 127, 96, 64, 32,
    ]);
    expect(printedTexts(calls)).toEqual(expect.arrayContaining([
      "Step 4",
      "Cutoff",
      "AT  ", "(64) ",
      "CC74", "--   ",
      "Sch5", "100  ",
      "--  ", "--   ",
      "CC10", "--   ",
    ]));
    expect(calls).toContainEqual(["fill", 0, 46, 128, 1, 1]);
    expect(calls).toContainEqual(["fill", 0, 57, 128, 1, 1]);
    expect(calls).toContainEqual(["fill", 19, 47, 1, 10, 1]);
    expect(calls).toContainEqual(["fill", 65, 10, 29, 18, 1]);
    expect(calls).toContainEqual(["fill", 64, 60, 59, 3, 1]);
  });

  test("reuses cached graph data between poll intervals", () => {
    S.ccGraphOvKey = "sg_0_1_2";
    S.ccGraphOvData = [0, 127, 64, 32];
    S.tickCount = 3;
    const calls: DrawCall[] = [];
    const { deps, getCalls } = createDeps(calls, {
      t0_c1_ccsv_2_0: "127 127 127 127",
    });

    renderCcStepEditView(deps);

    expect(getCalls).toEqual([]);
    expect(S.ccGraphOvData).toEqual([0, 127, 64, 32]);
    expect(calls).toContainEqual(["fill", 95, 47, 1, 10, 1]);
  });

  test("renders an empty graph fallback when DSP graph pages are missing", () => {
    S.heldStep = 4;
    S.ccLaneLength[0][1][2] = 8;
    const calls: DrawCall[] = [];
    const { deps, getCalls } = createDeps(calls);

    renderCcStepEditView(deps);

    expect(getCalls).toEqual(["t0_c1_ccsv_2_0"]);
    expect(S.ccGraphOvData).toEqual([]);
    expect(calls).toContainEqual(["fill", 126, 47, 1, 10, 1]);
    expect(printedTexts(calls)).toEqual(expect.arrayContaining(["Step 5", "Cutoff"]));
  });

  // Full ordered draw-sequence pin for the shared CC-lane overlay extraction
  // (graph-data fetch loop, graph frame+line-plot, page-progress bar). Catches
  // an EXTRA / MISSING / REORDERED draw call the toContainEqual specs above
  // cannot. One stopped capture suffices: heldStep=3 (beforeEach) exercises the
  // Step-Edit always-on step marker; the playing progress-dot variant is pinned
  // by the toContainEqual specs above.
  test("full draw sequence: graph fetch + frame/plot + step marker + page bar", () => {
    const calls: DrawCall[] = [];
    const { deps } = createDeps(calls, {
      t0_c1_ccsv_2_0: "0 8 16 24 32 40 48 56 64 72 80 88 96 104 112 120",
      t0_c1_ccsv_2_1: "127 96 64 32",
    });

    renderCcStepEditView(deps);

    expect(fmtSeq(calls)).toMatchInlineSnapshot(`
      "fill 0,46,128,1,1
      fill 0,57,128,1,1
      fill 0,46,1,12,1
      fill 127,46,1,12,1
      fill 1,55,1,1,1
      fill 2,55,1,1,1
      fill 3,55,1,1,1
      fill 4,55,1,1,1
      fill 5,55,1,1,1
      fill 6,55,1,1,1
      fill 7,55,1,1,1
      fill 8,55,1,1,1
      fill 9,55,1,1,1
      fill 10,55,1,1,1
      fill 11,55,1,1,1
      fill 12,55,1,1,1
      fill 13,54,1,2,1
      fill 14,54,1,1,1
      fill 15,54,1,1,1
      fill 16,54,1,1,1
      fill 17,54,1,1,1
      fill 18,54,1,1,1
      fill 19,54,1,1,1
      fill 20,54,1,1,1
      fill 21,54,1,1,1
      fill 22,54,1,1,1
      fill 23,54,1,1,1
      fill 24,54,1,1,1
      fill 25,54,1,1,1
      fill 26,53,1,2,1
      fill 27,53,1,1,1
      fill 28,53,1,1,1
      fill 29,53,1,1,1
      fill 30,53,1,1,1
      fill 31,53,1,1,1
      fill 32,53,1,1,1
      fill 33,53,1,1,1
      fill 34,53,1,1,1
      fill 35,53,1,1,1
      fill 36,53,1,1,1
      fill 37,53,1,1,1
      fill 38,53,1,1,1
      fill 39,52,1,2,1
      fill 40,52,1,1,1
      fill 41,52,1,1,1
      fill 42,52,1,1,1
      fill 43,52,1,1,1
      fill 44,52,1,1,1
      fill 45,52,1,1,1
      fill 46,52,1,1,1
      fill 47,52,1,1,1
      fill 48,52,1,1,1
      fill 49,52,1,1,1
      fill 50,52,1,1,1
      fill 51,52,1,1,1
      fill 52,51,1,2,1
      fill 53,51,1,1,1
      fill 54,51,1,1,1
      fill 55,51,1,1,1
      fill 56,51,1,1,1
      fill 57,51,1,1,1
      fill 58,51,1,1,1
      fill 59,51,1,1,1
      fill 60,51,1,1,1
      fill 61,51,1,1,1
      fill 62,51,1,1,1
      fill 63,51,1,1,1
      fill 64,51,1,1,1
      fill 65,51,1,1,1
      fill 66,51,1,1,1
      fill 67,51,1,1,1
      fill 68,51,1,1,1
      fill 69,51,1,1,1
      fill 70,51,1,1,1
      fill 71,50,1,2,1
      fill 72,50,1,1,1
      fill 73,50,1,1,1
      fill 74,50,1,1,1
      fill 75,50,1,1,1
      fill 76,50,1,1,1
      fill 77,50,1,1,1
      fill 78,50,1,1,1
      fill 79,50,1,1,1
      fill 80,50,1,1,1
      fill 81,50,1,1,1
      fill 82,50,1,1,1
      fill 83,50,1,1,1
      fill 84,49,1,2,1
      fill 85,49,1,1,1
      fill 86,49,1,1,1
      fill 87,49,1,1,1
      fill 88,49,1,1,1
      fill 89,49,1,1,1
      fill 90,49,1,1,1
      fill 91,49,1,1,1
      fill 92,49,1,1,1
      fill 93,49,1,1,1
      fill 94,49,1,1,1
      fill 95,49,1,1,1
      fill 96,48,1,2,1
      fill 97,48,1,1,1
      fill 98,48,1,1,1
      fill 99,48,1,1,1
      fill 100,48,1,1,1
      fill 101,48,1,1,1
      fill 102,48,1,1,1
      fill 103,48,1,1,1
      fill 104,48,1,1,1
      fill 105,48,1,1,1
      fill 106,48,1,1,1
      fill 107,48,1,1,1
      fill 108,48,1,1,1
      fill 109,48,1,3,1
      fill 110,50,1,1,1
      fill 111,50,1,1,1
      fill 112,50,1,1,1
      fill 113,50,1,1,1
      fill 114,50,1,1,1
      fill 115,50,1,1,1
      fill 116,50,1,2,1
      fill 117,51,1,1,1
      fill 118,51,1,1,1
      fill 119,51,1,1,1
      fill 120,51,1,1,1
      fill 121,51,1,1,1
      fill 122,51,1,3,1
      fill 123,53,1,1,1
      fill 124,53,1,1,1
      fill 125,53,1,1,1
      fill 126,53,1,1,1
      fill 19,47,1,10,1
      pixel 1,1,'Step 4',1
      pixel 91,1,'Cutoff',1
      fill 0,7,128,1,1
      print 4,11,'AT  ',1
      print 4,20,'(64) ',1
      print 35,11,'CC74',1
      print 35,20,'--   ',1
      fill 65,10,29,18,1
      print 66,11,'Sch5',0
      print 66,20,'100  ',0
      print 97,11,'--  ',1
      print 97,20,'--   ',1
      print 4,29,'CC72',1
      print 4,38,'(127)',1
      print 35,29,'CC91',1
      print 35,38,'(0)  ',1
      print 66,29,'CC93',1
      print 66,38,'(32) ',1
      print 97,29,'CC10',1
      print 97,38,'--   ',1
      fill 4,62,59,1,1
      fill 64,60,59,3,1"
    `);
  });
});
