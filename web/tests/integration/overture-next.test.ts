import { beforeEach, describe, expect, test, vi } from "vitest";
import {
  NAV,
  NOTE_OFF,
  NOTE_ON,
  PAD_NOTE0,
  STEP_CC0,
} from "../../../overture-next/src/host/move-controls";
import { OVERTURE_LED_COLOR } from "../../../overture-next/src/ports/led-colors";
import { createHarness } from "./harness.js";

describe("overture-next emulator integration", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  test("boots through the headless emulator host", async () => {
    const h = await createHarness();

    expect(globalThis.overtureRuntime?.isReady()).toBe(true);
    expect(h.state()).toMatchObject({
      selectedTrackIndex: 0,
      activeTrack: 0,
      sessionView: true,
      playing: false,
    });
    expect(
      h.snapshot().prints.length +
        h.snapshot().rects.length +
        h.snapshot().pixels.length,
    ).toBeGreaterThan(0);
    expect(h.rec.litLedCount()).toBeGreaterThan(0);
  });

  test("routes hardware input into Overture state", async () => {
    const h = await createHarness();

    h.pressCc(NAV.Play);
    expect(h.state().playing).toBe(true);

    h.pressCc(NAV.Menu);
    h.note(NOTE_ON, STEP_CC0 + 1, 127);
    h.step(1);
    expect(h.state().steps[1]).toMatchObject({ active: true });
    expect(h.rec.leds.get(STEP_CC0 + 1)).toBe(OVERTURE_LED_COLOR.active);

    expect(h.state().sessionView).toBe(false);
  });

  test("keeps default-active Session pads showing playback state while Shift is held", async () => {
    const h = await createHarness();

    expect(h.state().sessionView).toBe(true);

    h.cc(NAV.Shift, 127);
    h.step(1);

    expect(
      [0, 8, 16, 24].map((padIndex) => h.rec.leds.get(PAD_NOTE0 + padIndex)),
    ).toEqual([
      OVERTURE_LED_COLOR.playing,
      OVERTURE_LED_COLOR.playing,
      OVERTURE_LED_COLOR.playing,
      OVERTURE_LED_COLOR.playing,
    ]);
  });

  test("routes emitted host commands through the emulator sinks", async () => {
    const h = await createHarness();

    h.pressCc(NAV.Menu);
    h.tapNote(PAD_NOTE0 + 7, 101);

    expect(h.rec.moveMidi).toEqual([
      [(2 << 4) | 0x09, NOTE_ON, 67, 101],
      [(2 << 4) | 0x08, NOTE_OFF, 67, 0],
    ]);

    h.cc(NAV.Shift, 127);
    h.pressCc(43);
    h.cc(NAV.Shift, 0);
    h.tapNote(PAD_NOTE0, 99);

    expect(h.state().selectedTrackIndex).toBe(4);
    expect(h.rec.schwungMidi).toContainEqual([[NOTE_ON | 4, 60, 99]]);
    expect(h.rec.schwungMidi).toContainEqual([[NOTE_OFF | 4, 60, 0]]);

    h.cc(NAV.Shift, 127);
    h.pressCc(40);
    h.cc(NAV.Shift, 0);
    h.tapNote(PAD_NOTE0, 88);

    expect(h.state().selectedTrackIndex).toBe(7);
    expect(h.rec.schwungMidi).toContainEqual([[NOTE_ON | 7, 60, 88]]);
    expect(h.rec.schwungMidi).toContainEqual([[NOTE_OFF | 7, 60, 0]]);
  });

  test("starts Schwung playback from a launched Track 8 Session clip", async () => {
    const h = await createHarness();

    h.cc(NAV.Shift, 127);
    h.pressCc(40);
    h.cc(NAV.Shift, 0);

    expect(h.state()).toMatchObject({
      selectedTrackIndex: 7,
      sessionView: true,
      playing: false,
    });

    h.pressCc(NAV.Play);

    expect(h.state().playing).toBe(true);
    expect(h.rec.schwungMidi).toContainEqual([[NOTE_ON | 7, 60, 100]]);
  });
});
