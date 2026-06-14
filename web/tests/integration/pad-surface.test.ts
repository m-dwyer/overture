import { describe, expect, test } from "vitest";
import {
  buildDspPadMapPayload,
  createLiveNoteQueues,
  queueLiveNoteOff,
  queueLiveNoteOn,
  updatePadNoteMap,
} from "@tool-ui/ui_pad_surface.mjs";

function baseState() {
  return {
    activeTrack: 0,
    trackPadMode: [0],
    drumLanePage: [0],
    drumLaneNote: [Array.from({ length: 32 }, (_, i) => 36 + i)],
    moveCoRunTrack: -1,
    xposePrevKey: null,
    xposePrevScale: null,
    padKey: 0,
    padScale: 0,
    padOctave: [3],
    padLayoutChromatic: [false],
    padScaleSet: new Set<number>(),
    padNoteMap: new Array(32).fill(0),
    trackOctave: [0],
    sessionView: false,
    extSendAsyncEnabled: false,
    deleteHeld: false,
  };
}

const deps = {
  PAD_MODE_DRUM: 1,
  DRUM_LANES: 32,
  DRUM_BASE_NOTE: 36,
};

describe("pad surface", () => {
  test("live note queues are track-scoped and preserve event shape", () => {
    const queues = createLiveNoteQueues(2);

    queueLiveNoteOn(queues, 1, 64, 99);
    queueLiveNoteOff(queues, 1, 64);
    queueLiveNoteOn(queues, 0, 36, 110);

    expect(queues[0]).toEqual([{ isOff: false, pitch: 36, vel: 110 }]);
    expect(queues[1]).toEqual([
      { isOff: false, pitch: 64, vel: 99 },
      { isOff: true, pitch: 64 },
    ]);
  });

  test("drum pad map uses lane notes on the left half and sentinels for velocity zones", () => {
    const S = baseState();
    S.trackPadMode[0] = 1;
    S.drumLaneNote[0][0] = 48;

    updatePadNoteMap(S, deps);

    expect(S.padNoteMap.slice(0, 8)).toEqual([48, 37, 38, 39, 0xff, 0xff, 0xff, 0xff]);
    expect(S.padNoteMap[8]).toBe(40);
  });

  test("drum pad map mutes lane pads during Move-native co-run", () => {
    const S = baseState();
    S.trackPadMode[0] = 1;
    S.moveCoRunTrack = 0;

    updatePadNoteMap(S, deps);

    expect(S.padNoteMap).toEqual(new Array(32).fill(0xff));
  });

  test("melodic scale map records scale pitch classes and marks out-of-range pads", () => {
    const S = baseState();
    S.padOctave[0] = 10;
    S.padKey = 0;
    S.padScale = 0;

    updatePadNoteMap(S, deps);

    expect(S.padScaleSet.has(0)).toBe(true);
    expect(S.padScaleSet.has(1)).toBe(false);
    expect(S.padNoteMap[0]).toBe(120);
    expect(S.padNoteMap[1]).toBe(122);
    expect(S.padNoteMap[24]).toBe(0xff);
  });

  test("DSP padmap payload bakes track octave and appends capability flags", () => {
    const S = baseState();
    S.padOctave[0] = 3;
    S.trackOctave[0] = 1;
    S.extSendAsyncEnabled = true;
    S.deleteHeld = true;
    updatePadNoteMap(S, deps);

    const payload = buildDspPadMapPayload(S, deps, false);
    const parts = payload.split(" ").map(Number);

    expect(parts[0]).toBe(48);
    expect(parts[1]).toBe(50);
    expect(parts).toHaveLength(35);
    expect(parts.slice(-3)).toEqual([1, 0, 1]);
  });

  test("DSP padmap payload mutes every pad in session view while modal dispatch is muted", () => {
    const S = baseState();
    S.sessionView = true;
    updatePadNoteMap(S, deps);

    const payload = buildDspPadMapPayload(S, deps, true);
    const parts = payload.split(" ").map(Number);

    expect(parts.slice(0, 32)).toEqual(new Array(32).fill(0xff));
    expect(parts.slice(-3)).toEqual([0, 1, 0]);
  });
});
