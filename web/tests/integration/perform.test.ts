import { describe, test, expect, beforeEach } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// Perform-cluster workflows driven through the REAL ui.js + seq8-wasm. The track
// mute/solo path has no DSP get_param readback (JS-only state), so those assert
// S (h.ui()); transpose and tap-tempo DO reach the engine (key/scale/bpm
// getters) and assert engine truth. Targets perform/ui_mute_solo_workflow.mjs,
// perform/ui_transpose_workflow.mjs, perform/ui_tap_tempo_workflow.mjs — all
// ~100% unit but <13% behaviour at the Step-1 baseline.

const MUTE = 88; // MoveMute

/** Enter Note/Track view (mute/transpose gestures are Track-View only). */
function trackView(h: Harness): void {
  if (h.ui().sessionView) {
    h.press(50);
    h.step(2);
  }
}

describe("Track mute / solo (real ui.js — JS-state truth)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
    trackView(h);
    h.ui().activeTrack = 1; // melodic track: mute press isn't consumed as a drum modifier
    h.step(1);
  }, 60_000);

  test("Mute button toggles the active track's mute (on release)", () => {
    expect(h.ui().trackMuted[1]).toBe(false);

    h.press(MUTE);
    h.step(1);
    expect(h.ui().trackMuted[1]).toBe(true);

    h.press(MUTE);
    h.step(1);
    expect(h.ui().trackMuted[1]).toBe(false);
  });

  test("Shift+Mute solos the track and clears its mute (mutually exclusive)", () => {
    // Mute first.
    h.press(MUTE);
    h.step(1);
    expect(h.ui().trackMuted[1]).toBe(true);

    // Shift held on release → solo; solo clears the mute bit.
    h.ui().shiftHeld = true;
    h.press(MUTE);
    h.ui().shiftHeld = false;
    h.step(1);
    expect(h.ui().trackSoloed[1]).toBe(true);
    expect(h.ui().trackMuted[1]).toBe(false);
  });

  test("Delete+Mute clears mute/solo across all tracks", () => {
    h.ui().trackMuted[0] = true;
    h.ui().trackMuted[1] = true;
    h.ui().trackSoloed[2] = true;

    h.ui().deleteHeld = true;
    h.emu.sendInternal(0xb0, MUTE, 127); // Delete+Mute press → clearAllMuteSolo
    h.step(1);
    h.emu.sendInternal(0xb0, MUTE, 0);
    h.ui().deleteHeld = false;
    h.step(1);

    expect(h.ui().trackMuted[0]).toBe(false);
    expect(h.ui().trackMuted[1]).toBe(false);
    expect(h.ui().trackSoloed[2]).toBe(false);
  });
});

describe("Tap tempo (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
  }, 60_000);

  test("menu Tap Tempo opens the dialog; grid taps set the engine bpm", () => {
    h.menuOpen();
    h.menuSelect("Tap Tempo");
    h.jogClick(); // action → openTapTempo
    expect(h.ui().tapTempoOpen).toBe(true);

    // Tap the grid a few times — fast taps clamp bpm toward the 250 ceiling, but
    // the point is the tap path reaches the engine (set_param('bpm')).
    for (let i = 0; i < 5; i++) {
      h.emu.sendInternal(0x90, 68, 110);
      h.step(1);
      h.emu.sendInternal(0x80, 68, 0);
      h.step(1);
    }
    const bpm = Number(h.get("bpm"));
    expect(bpm).toBeGreaterThanOrEqual(40);
    expect(bpm).toBeLessThanOrEqual(250);
    expect(h.ui().tapTempoBpm).toBe(bpm); // JS and engine agree

    // Jog-click closes the dialog (closeTapTempo → final bpm push). Closing also
    // keeps tapTempoOpen off the ui.js singleton for the next test.
    h.jogClick();
    expect(h.ui().tapTempoOpen).toBe(false);
    expect(Number(h.get("bpm"))).toBe(h.ui().tapTempoBpm);
  });
});

describe("Transpose via menu (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
  }, 60_000);

  test("editing the Key enum and committing transposes the engine key", () => {
    const startKey = Number(h.get("key"));

    h.menuOpen();
    h.menuSelect("Key");
    h.jogClick();        // enter enum editing
    h.jogTurn(1);        // bump the candidate key
    h.jogTurn(1);
    h.jogClick();        // finalize the enum edit
    // With melodic content the finalize opens a "Transpose all clips?" confirm
    // (default Yes); empty clips commit silently. Handle both so the test is
    // robust to whatever a prior test left on the ui.js singleton.
    if (h.ui().confirmXpose) h.jogClick();
    h.step(5);           // drain the deferred t0_xpose_apply

    const newKey = Number(h.get("key"));
    expect(newKey).not.toBe(startKey);
    expect(h.ui().padKey).toBe(newKey); // committed value mirrors the engine
  });
});
