import { describe, test, expect, beforeAll } from "vitest";
import { createHarness, type Harness } from "./harness.js";

describe("sequencer round-trips (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeAll(async () => { h = await createHarness(); }, 60_000);

  // NOTE: Menu (CC50) tap relies on real time between press/release. The harness
  // press() puts a tick between them (like a human); Playwright's instant .click()
  // is synchronous (0ms) and misses the tap window — which is why the browser E2E
  // saw "no change". With realistic timing the toggle works, as asserted here.
  test("Menu changes the OLED view (Session ↔ Note)", () => {
    const before = h.rec.text();
    expect(before).toContain("Overture");
    h.press(50); h.step(5);
    expect(h.rec.text(), "Menu should change the view").not.toBe(before);
    h.press(50); h.step(5); // restore
  });

  test("pressing a pad emits a note from the engine", () => {
    h.press(50); h.step(5); // into Note view (the active track plays its pads)
    const before = h.rec.midiOut.length;
    h.pad(0); // emits e.g. [tag, cable2, 0x90, 36 (C1 drum pad), vel]
    expect(h.rec.midiOut.length, "pad press should produce engine MIDI").toBeGreaterThan(before);
    // Recorded packet is [tag, CIN, status, d1, d2] — status at index 2.
    expect(h.rec.midiOut.some((m) => (m[2] & 0xf0) === 0x90), "a note-on should be emitted").toBe(true);
    h.press(50); h.step(5); // restore
  });

  // TODO: melodic step-toggle round-trip (tapStep → tN_cM_steps bitmap) needs a
  // track in melodic mode — track 1 defaults to drum (steps use lane keys). Add
  // once the "switch track to melodic" gesture is pinned. The shell now sends
  // steps as NOTE 16..31 (the fix this branch made), so it'll be ready.
});
