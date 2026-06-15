import { beforeEach, describe, expect, test } from "vitest";
import { S } from "@tool-ui/ui_state.mjs";
import {
  renderSessionIdleView,
  renderDrumTrackIdleView,
  renderMelodicTrackIdleView,
} from "@tool-ui/ui_idle_render.mjs";

type DrawCall = [string, ...unknown[]];

function createDeps(calls: DrawCall[]) {
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
});
