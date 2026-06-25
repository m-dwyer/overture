import { beforeEach, describe, expect, test } from "vitest";
import { S } from "@overture-ui/core/ui_state.mjs";
import { renderParamPeek } from "@overture-ui/render/ui_param_peek_render.mjs";

type DrawCall = [string, ...unknown[]];

function createDeps(calls: DrawCall[]) {
  return {
    fill_rect: (x: number, y: number, w: number, h: number, color: number) => calls.push(["fill", x, y, w, h, color]),
    print: (x: number, y: number, text: string, color: number) => calls.push(["print", x, y, text, color]),
  };
}

describe("Param Peek presentation", () => {
  beforeEach(() => {
    S.activeTrack = 0;
    S.activeBank = 6;
    S.trackPadMode[0] = 0;
    S.trackActiveClip[0] = 0;
    S.knobTouched = 1;
    S.knobTouchStartTick = 100;
    S.tickCount = 100;
    S.trackRoute[0] = 1;
    S.trackChannel[0] = 1;
    S.trackCCType[0] = [1, 0, 2, 0, 0, 0, 0, 0];
    S.trackCCAssign[0] = [7, 74, 5, -1, 72, 91, 93, 10];
    S.trackCCLiveVal[0] = [-1, -1, -1, -1, -1, -1, -1, -1];
    S.clipCCVal[0][0] = [-1, 64, 99, -1, -1, -1, -1, -1];
    S.clipLength[0][0] = 16;
    S.clipTPS[0][0] = 24;
    S.ccLaneLength[0][0][1] = 0;
    S.ccLaneTps[0][0][1] = 0;
    S.ccLaneResTps[0][0][1] = 0;
    S.playing = false;
  });

  test("renders Param Peek through shared focused parameter feedback", () => {
    const calls: DrawCall[] = [];
    renderParamPeek(createDeps(calls));

    expect(calls).toContainEqual(["fill", 0, 0, 128, 9, 1]);
    expect(calls).toContainEqual(["print", 2, 1, "AUTO T1 Clip A Cl", 0]);
    expect(calls).toContainEqual(["print", 110, 1, "K2", 0]);
    expect(calls).toContainEqual(["print", 0, 14, "Move target", 1]);
    expect(calls).toContainEqual(["print", 58, 38, "64", 0]);
    expect(calls).toContainEqual(["fill", 0, 55, 128, 1, 1]);
  });

  test("wraps long focused parameter labels", () => {
    S.trackRoute[0] = 0;
    S.trackCCType[0][1] = 2;
    S.trackCCAssign[0][1] = 8;
    S.schLabel[0][1] = "Very Long Schwung Parameter Name";

    const calls: DrawCall[] = [];
    renderParamPeek(createDeps(calls));

    expect(calls).toContainEqual(["print", 0, 14, "Sch K8 Very Long", 1]);
    expect(calls).toContainEqual(["print", 0, 24, "Schwung", 1]);
  });
});
