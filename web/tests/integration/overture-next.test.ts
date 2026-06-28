import { beforeEach, describe, expect, test, vi } from "vitest";
import { NAV, NOTE_OFF, NOTE_ON, PAD_NOTE0, STEP_CC0 } from "../../../overture-next/src/host/move-controls";
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
      sessionView: false,
      playing: false,
    });
    expect(h.snapshot().prints.length + h.snapshot().rects.length + h.snapshot().pixels.length).toBeGreaterThan(0);
    expect(h.rec.litLedCount()).toBeGreaterThan(0);
  });

  test("routes hardware input into Overture state", async () => {
    const h = await createHarness();

    h.pressCc(NAV.Play);
    expect(h.state().playing).toBe(true);

    h.note(NOTE_ON, STEP_CC0 + 1, 127);
    h.step(1);
    expect(h.state().steps[1]).toMatchObject({ active: true, selected: true });
    expect(h.rec.leds.get(STEP_CC0 + 1)).toBe(OVERTURE_LED_COLOR.active);

    h.pressCc(NAV.Menu);
    expect(h.state().sessionView).toBe(true);
  });

  test("renders shifted Session View Surface Hints on the selected scene pads", async () => {
    const h = await createHarness();

    h.pressCc(NAV.Menu);
    expect(h.state().sessionView).toBe(true);

    h.cc(NAV.Shift, 127);
    h.step(1);

    expect([0, 8, 16, 24].map((padIndex) => h.rec.leds.get(PAD_NOTE0 + padIndex))).toEqual([
      OVERTURE_LED_COLOR.hint,
      OVERTURE_LED_COLOR.hint,
      OVERTURE_LED_COLOR.hint,
      OVERTURE_LED_COLOR.hint,
    ]);
  });

  test("routes emitted host commands through the emulator sinks", async () => {
    const h = await createHarness();

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
  });
});
