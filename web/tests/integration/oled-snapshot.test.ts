import { describe, test, expect, beforeEach } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// Deterministic OLED capture. The Playwright spike (web/tests/manual-shots.spec.ts)
// screenshots the live emulator in REAL TIME, so a screen that lives only a few
// ticks (action popups, bank overlays, momentary views) is a race — the shot can
// land before or after it. Here the tick clock is ours: we step to the exact tick
// a momentary screen is active and snapshot() captures the rendered frame (the
// real ui.js drawUI output, via the recorder), with no race.

const padForLane = (lane: number): number => Math.floor(lane / 4) * 8 + (lane % 4);
const ACTION_POPUP_TICKS = 49; // ui/core/ui_constants.mjs — ~520ms at 94Hz

function drumTrackView(h: Harness): void {
  if (h.ui().sessionView) {
    h.press(50);
    h.step(2);
  }
  const s = h.ui();
  s.activeTrack = 0;
  s.activeBank = 0;
  s.activeDrumLane[0] = 0;
  s.drumStepPage[0] = 0;
  h.step(1);
}

describe("OLED snapshot — deterministic momentary-screen capture", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
  }, 60_000);

  test("snapshot() captures the rendered main-view frame (structured draws)", () => {
    const frame = h.snapshot();
    // The real ui.js drew *something*: text and/or rects/pixels, at a real tick.
    expect(frame.tick).toBeGreaterThan(0);
    expect(frame.prints.length + frame.rects.length + frame.pixels.length).toBeGreaterThan(0);
  });

  test("a momentary action popup is captured at its tick and gone after expiry", () => {
    drumTrackView(h);

    // Fire a momentary popup: Copy + drum-lane pad shows "COPIED" for 49 ticks.
    const s = h.ui();
    s.copyHeld = true;
    h.emu.sendInternal(0x90, 68 + padForLane(0), 110);
    h.step(1);
    h.emu.sendInternal(0x80, 68 + padForLane(0), 0);
    h.step(1);
    s.copyHeld = false;

    // At this tick the popup is on the OLED — capture proves it rendered.
    const shown = h.snapshot();
    expect(shown.text).toContain("COPIED");

    // Step past the popup's lifetime; the renderer stops drawing it (gate:
    // tickCount <= actionPopupEndTick), so the frame no longer contains it.
    h.step(ACTION_POPUP_TICKS + 5);
    const after = h.snapshot();
    expect(after.text).not.toContain("COPIED");
  });

  test("snapshot() is repeatable without advancing playback (transport stays put)", () => {
    expect(h.get("playing")).toBe("0");
    const a = h.snapshot();
    const b = h.snapshot();
    // Two snapshots one forced-redraw tick apart; transport must not have moved.
    expect(h.get("playing")).toBe("0");
    expect(b.tick).toBe(a.tick + 1);
  });
});
