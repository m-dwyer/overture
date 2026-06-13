import { describe, beforeEach, test, expect } from "vitest";
// @ts-expect-error Vite remaps the on-device module path to tool/ui during tests.
import { S } from "/data/UserData/schwung/modules/tools/overture/ui_state.mjs";
// @ts-expect-error Vite remaps the on-device module path to tool/ui during tests.
import { describeEditSoundForTrack, matchingSchwungSlotMask, routeScopeShortLabel } from "/data/UserData/schwung/modules/tools/overture/ui_routes.mjs";
// @ts-expect-error Vite remaps the on-device module path to tool/ui during tests.
import { PARAM_PEEK_DETAIL_TICKS, autoLaneLabel, paramPeekInfo } from "/data/UserData/schwung/modules/tools/overture/ui_motion.mjs";

describe("UI descriptor seams", () => {
  beforeEach(() => {
    S.activeTrack = 0;
    S.activeBank = 6;
    S.playing = false;
    S.tickCount = 100;
    S.knobTouched = 1;
    S.knobTouchStartTick = 100;
    S.trackRoute[0] = 1;
    S.trackChannel[0] = 1;
    S.trackRoute[4] = 0;
    S.trackChannel[4] = 5;
    S.trackPadMode[0] = 0;
    S.trackActiveClip[0] = 0;
    S.trackQueuedClip[0] = -1;
    S.trackCCType[0] = [1, 0, 2, 0, 0, 0, 0, 0];
    S.trackCCAssign[0] = [7, 74, 5, -1, 72, 91, 93, 10];
    S.clipCCVal[0][0][1] = 64;
    S.clipLength[0][0] = 16;
    S.clipTPS[0][0] = 24;
    S.ccLaneLength[0][0][1] = 0;
    S.ccLaneTps[0][0][1] = 0;
    S.ccLaneResTps[0][0][1] = 0;
    Reflect.set(globalThis, "shadow_get_slots", () => [
      { channel: 5, name: "Slot1" },
      { channel: 6, name: "Slot2" },
      { channel: 0, name: "Layer" },
    ]);
  });

  test("Schwung slot masks include exact-channel and All-channel slots", () => {
    expect(matchingSchwungSlotMask(5, [
      { channel: 5 },
      { channel: 6 },
      { channel: 0 },
      { channel: 5 },
    ])).toBe(0b1101);
  });

  test("Edit Sound descriptor preserves Move and Schwung preflight cases", () => {
    expect(describeEditSoundForTrack(0, { hasCoRun: true, hasMoveInject: true })).toMatchObject({
      title: "EDIT SOUND",
      body: "T1 Move Ch1",
      queue: { track: 0, route: 1, slot: -1 },
    });

    S.trackChannel[0] = 5;
    expect(describeEditSoundForTrack(0, { hasCoRun: true, hasMoveInject: true })).toMatchObject({
      title: "MOVE CH>4",
      body: "Ch5",
      queue: { track: 0, route: 1, slot: -1 },
    });

    expect(describeEditSoundForTrack(4, { hasCoRun: true, hasMoveInject: true })).toMatchObject({
      title: "EDIT SOUND",
      body: "T5 Schwung Slot1",
      queue: { track: 4, route: 0, slot: 0 },
      slotMask: 0b0101,
    });

    Reflect.set(globalThis, "shadow_get_slots", () => [{ channel: 6, name: "Slot2" }]);
    expect(describeEditSoundForTrack(4, { hasCoRun: true, hasMoveInject: true })).toMatchObject({
      title: "NO SLOT",
      body: "Ch5",
      queue: { track: 4, route: 0, slot: 0 },
    });
  });

  test("route labels distinguish Move, External, Schwung slot, and Schwung channel fallback", () => {
    expect(routeScopeShortLabel(0)).toBe("Move Ch1");
    S.trackRoute[0] = 2;
    expect(routeScopeShortLabel(0)).toBe("Ext Ch1");
    S.trackRoute[0] = 0;
    S.trackChannel[0] = 5;
    expect(routeScopeShortLabel(0)).toBe("Schw S1");
    Reflect.set(globalThis, "shadow_get_slots", () => [{ channel: 8, name: "Slot4" }]);
    expect(routeScopeShortLabel(0)).toBe("Schw Ch5");
  });

  test("motion descriptors preserve AUTO labels and Param Peek text", () => {
    expect(autoLaneLabel(0, 0, false)).toBe("AT");
    expect(autoLaneLabel(0, 1, true)).toBe("L2 CC74");
    expect(autoLaneLabel(0, 2, false)).toBe("Sch5");
    expect(autoLaneLabel(0, 3, false)).toBe("--");

    expect(paramPeekInfo()).toMatchObject({
      header: "AUTO T1 Clip A",
      target: "Move target",
      value: "Value 64",
      detail: "Clip A, Lane 2",
      route: "Route: Move Ch1",
    });

    S.ccLaneLength[0][0][1] = 32;
    S.ccLaneTps[0][0][1] = 12;
    S.ccLaneResTps[0][0][1] = 24;
    S.tickCount = PARAM_PEEK_DETAIL_TICKS;
    S.knobTouchStartTick = 0;
    expect(paramPeekInfo()).toMatchObject({
      header: "Move target",
      target: "Lane 2 / Clip A",
      value: "Route: Move Ch1",
      detail: "Loop 32 steps",
      route: "Res 1/16 Zoom 1/32",
    });
  });
});
