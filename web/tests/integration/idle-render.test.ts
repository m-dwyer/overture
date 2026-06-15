import { beforeEach, describe, expect, test } from "vitest";
import { S } from "@tool-ui/ui_state.mjs";
import {
  renderSessionIdleView,
  renderDrumTrackIdleView,
  renderMelodicTrackIdleView,
  renderMotionIdleView,
} from "@tool-ui/ui_idle_render.mjs";

type DrawCall = [string, ...unknown[]];

function createDeps(calls: DrawCall[], values: Record<string, string | null> = {}) {
  const getCalls: string[] = [];
  return {
    pixelPrint: (x: number, y: number, text: string, color: number) => calls.push(["pixel", x, y, text, color]),
    print: (x: number, y: number, text: string, color: number) => calls.push(["print", x, y, text, color]),
    fill_rect: (x: number, y: number, w: number, h: number, color: number) => calls.push(["fill", x, y, w, h, color]),
    drawBankHeading: (name: string, showTrack?: boolean) => calls.push(["heading", name, showTrack]),
    drawBankHeadingInverted: (name: string, showTrack?: boolean) => calls.push(["headingInv", name, showTrack]),
    drawMetroIndicator: () => calls.push(["metro"]),
    drawTrackRow: (y: number) => calls.push(["trackRow", y]),
    drawPositionBar: (track: number) => calls.push(["positionBar", track]),
    drawDrumPositionBar: (track: number) => calls.push(["drumPositionBar", track]),
    host_module_get_param: (key: string) => {
      getCalls.push(key);
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : null;
    },
    getCalls,
  };
}

function pixelTexts(calls: DrawCall[]) {
  return calls
    .filter((call) => call[0] === "pixel")
    .map((call) => String(call[3]));
}

describe("Idle presentation", () => {
  beforeEach(() => {
    S.activeTrack = 0;
    S.activeBank = 0;
    S.tickCount = 100;
    S.trackPadMode = [0, 1, 0, 0, 0, 0, 0, 0];
    S.trackActiveClip = [1, 2, 0, 0, 0, 0, 0, 0];
    S.trackClipPlaying = [true, true, false, false, false, false, false, false];
    S.trackWillRelaunch = [false, false, false, false, false, false, false, false];
    S.trackQueuedClip = [-1, -1, -1, -1, -1, -1, -1, -1];
    S.clipNonEmpty = Array.from({ length: 8 }, () => new Array(16).fill(false));
    S.drumClipNonEmpty = Array.from({ length: 8 }, () => new Array(16).fill(false));
    S.clipNonEmpty[0][1] = true;
    S.drumClipNonEmpty[1][2] = true;
    S.bankParams = Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => new Array(8).fill(0))
    );
    S.recordArmed = false;
    S.playing = false;
    S.masterPos = 0;
    S.recordCountingIn = false;
    S.recordArmedTrack = -1;
    S.trackOctave = [1, 0, 0, 0, 0, 0, 0, 0];
    S.padKey = 0;
    S.padScale = 0;
    S.scaleAware = 1;
    S.activeDrumLane = [2, 0, 0, 0, 0, 0, 0, 0];
    S.drumLanePage = [1, 0, 0, 0, 0, 0, 0, 0];
    S.drumLaneNote = Array.from({ length: 8 }, () => new Array(32).fill(36));
    S.drumLaneNote[0][2] = 48;
    S.drumLaneSolo = [0, 0, 0, 0, 0, 0, 0, 0];
    S.drumLaneMute = [0, 0, 0, 0, 0, 0, 0, 0];
    S.trackCurrentPage = [1, 0, 0, 0, 0, 0, 0, 0];
    S.ccActiveLane = [2, 0, 0, 0, 0, 0, 0, 0];
    S.clipLength = Array.from({ length: 8 }, () => new Array(16).fill(16));
    S.clipLength[0][1] = 20;
    S.clipTPS = Array.from({ length: 8 }, () => new Array(16).fill(24));
    S.ccLaneLength = Array.from({ length: 8 }, () =>
      Array.from({ length: 16 }, () => new Array(8).fill(0))
    );
    S.ccLaneLength[0][1][2] = 20;
    S.ccLaneTps = Array.from({ length: 8 }, () =>
      Array.from({ length: 16 }, () => new Array(8).fill(0))
    );
    S.ccLaneTps[0][1][2] = 12;
    S.ccLaneResTps = Array.from({ length: 8 }, () =>
      Array.from({ length: 16 }, () => new Array(8).fill(0))
    );
    S.ccLaneResTps[0][1][2] = 48;
    S.trackCCType = Array.from({ length: 8 }, () => new Array(8).fill(0));
    S.trackCCType[0][0] = 1;
    S.trackCCType[0][2] = 2;
    S.trackCCAssign = Array.from({ length: 8 }, () => [7, 74, 5, -1, 72, 91, 93, 10]);
    S.schLabel = Array.from({ length: 8 }, () => new Array(8).fill(null));
    S.schLabel[0][2] = "Cutoff";
    S.trackCCAutoBits = Array.from({ length: 8 }, () => new Array(16).fill(0));
    S.trackCCAutoBits[0][1] = 1 << 2;
    S.clipAtHas = Array.from({ length: 8 }, () => new Array(16).fill(false));
    S.clipAtHas[0][1] = true;
    S.clipCCVal = Array.from({ length: 8 }, () =>
      Array.from({ length: 16 }, () => new Array(8).fill(-1))
    );
    S.clipCCVal[0][1][2] = 90;
    S.trackCCLiveVal = Array.from({ length: 8 }, () => new Array(8).fill(-1));
    S.trackCCLiveVal[0][2] = 64;
    S.ccGraphOvData = [];
    S.ccGraphOvKey = "";
    S.heldStep = -1;
  });

  test("renders Session View idle banner, active clips, and track row", () => {
    S.playing = true;
    S.masterPos = 192;
    const calls: DrawCall[] = [];
    renderSessionIdleView(createDeps(calls));

    expect(calls[0]).toEqual(["fill", 0, 0, 128, 12, 1]);
    expect(calls).toContainEqual(["print", 40, 2, "overture", 0]);
    expect(calls).toContainEqual(["metro"]);
    expect(calls).toContainEqual(["trackRow", 34]);
    expect(pixelTexts(calls)).toEqual(expect.arrayContaining(["B", "C"]));
    expect(calls).toContainEqual(["fill", 4, 45, 9, 7, 1]);
    expect(calls).toContainEqual(["fill", 20, 45, 9, 7, 1]);
  });

  test("renders melodic idle heading, arp/scale status, active clips, and position bar", () => {
    S.activeBank = 5;
    S.bankParams[0][5][0] = 1;
    S.bankParams[0][5][7] = 1;
    S.recordArmed = true;
    S.recordArmedTrack = 0;

    const calls: DrawCall[] = [];
    renderMelodicTrackIdleView(createDeps(calls));

    expect(calls[0]).toEqual(["headingInv", "ARP IN REC", false]);
    expect(pixelTexts(calls)).toEqual(expect.arrayContaining(["Oct:+1", "Arp", "C Major", "B", "C"]));
    expect(calls).toContainEqual(["fill", 51, 9, 19, 7, 1]);
    expect(calls).toContainEqual(["fill", 82, 15, 42, 1, 1]);
    expect(calls).toContainEqual(["metro"]);
    expect(calls).toContainEqual(["trackRow", 34]);
    expect(calls).toContainEqual(["positionBar", 0]);
    expect(calls).toContainEqual(["fill", 4, 45, 9, 7, 1]);
    expect(calls).toContainEqual(["fill", 20, 45, 9, 7, 1]);
  });

  test("renders drum idle lane status, active clips, and drum position bar", () => {
    S.trackPadMode[0] = 1;
    S.activeBank = 6;
    S.drumLaneSolo[0] = 1 << 2;
    S.drumClipNonEmpty[0][1] = true;

    const calls: DrawCall[] = [];
    renderDrumTrackIdleView(createDeps(calls));

    expect(calls[0]).toEqual(["headingInv", "AUTO", false]);
    expect(pixelTexts(calls)).toEqual(expect.arrayContaining(["Bank: B  Pad: C2 (48)", "SOLOED", "B", "C"]));
    expect(calls).toContainEqual(["metro"]);
    expect(calls).toContainEqual(["trackRow", 34]);
    expect(calls).toContainEqual(["drumPositionBar", 0]);
    expect(calls).toContainEqual(["fill", 4, 45, 9, 7, 1]);
    expect(calls).toContainEqual(["fill", 20, 45, 9, 7, 1]);
  });

  test("renders AUTO idle lane info, badges, graph, and current page", () => {
    const calls: DrawCall[] = [];
    const deps = createDeps(calls, {
      t0_c1_ccsv_2_0: "0 8 16 24 32 40 48 56 64 72 80 88 96 104 112 120",
      t0_c1_ccsv_2_1: "127 96 64 32",
    });

    renderMotionIdleView(deps);

    expect(deps.getCalls).toEqual(["t0_c1_ccsv_2_0", "t0_c1_ccsv_2_1"]);
    expect(S.ccGraphOvKey).toBe("g_0_1_2");
    expect(S.ccGraphOvData).toEqual([
      0, 8, 16, 24, 32, 40, 48, 56, 64, 72, 80, 88, 96, 104, 112, 120, 127, 96, 64, 32,
    ]);
    expect(calls).toContainEqual(["headingInv", "AUTO", undefined]);
    expect(calls).toContainEqual(["print", 61, 1, "Sch", 0]);
    expect(calls).toContainEqual(["print", 101, 1, "CC", 0]);
    expect(calls).toContainEqual(["print", 4, 10, "K3 L3 Sch5:", 1]);
    expect(calls).toContainEqual(["print", 70, 10, "90", 1]);
    expect(calls).toContainEqual(["print", 91, 10, "Cutoff", 1]);
    expect(calls).toContainEqual(["print", 4, 21, "Res: 1/8", 1]);
    expect(calls).toContainEqual(["print", 64, 21, "Zoom: 1/32", 1]);
    expect(calls).toContainEqual(["fill", 0, 33, 128, 1, 1]);
    expect(calls).toContainEqual(["fill", 0, 56, 128, 1, 1]);
    expect(calls).toContainEqual(["fill", 64, 60, 59, 3, 1]);
  });

  test("reuses AUTO idle graph cache between poll intervals", () => {
    S.ccGraphOvKey = "g_0_1_2";
    S.ccGraphOvData = [0, 127, 64, 32];
    S.tickCount = 3;
    const calls: DrawCall[] = [];
    const deps = createDeps(calls, {
      t0_c1_ccsv_2_0: "127 127 127 127",
    });

    renderMotionIdleView(deps);

    expect(deps.getCalls).toEqual([]);
    expect(S.ccGraphOvData).toEqual([0, 127, 64, 32]);
    expect(calls).toContainEqual(["fill", 32, 35, 1, 20, 1]);
  });

  test("renders AUTO idle playing progress with lane zoom TPS", () => {
    S.playing = true;
    S.masterPos = 120;
    S.trackCurrentPage[0] = 0;
    const calls: DrawCall[] = [];
    const deps = createDeps(calls);

    renderMotionIdleView(deps);

    expect(deps.getCalls).toEqual(["t0_c1_ccsv_2_0", "t0_c1_ccsv_2_1"]);
    expect(calls).toContainEqual(["fill", 4, 60, 59, 3, 1]);
    expect(calls).toContainEqual(["fill", 64, 60, 59, 1, 1]);
    expect(calls).toContainEqual(["fill", 64, 62, 59, 1, 1]);
    expect(calls).toContainEqual(["fill", 63, 60, 1, 3, 1]);
  });
});
