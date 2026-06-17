import { describe, test, expect, beforeEach } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// The UI sidecar (seq8-ui-state.json) carries UI-only state the DSP doesn't own:
// active track/clip, view toggles, per-track octave/bank/AT-mode, drum lane,
// perf mods, chromatic layout. These tests drive the REAL suspend→resume flow
// (Shift+Back writes the sidecar; init() re-read restores it) through the real
// ui.js + seq8-wasm + in-memory host files — the persistence roundtrip that was
// previously only provable on-device. Targets persist/ui_persistence.mjs
// (writeSidecar) + sync/ui_clip_state_sync.mjs (restoreUiSidecarImpl).

// With no active_set.txt the set UUID is "", so the sidecar lives at the
// non-UUID path (uuidToUiStatePath("")).
const SIDECAR_PATH = "/data/UserData/schwung/seq8-ui-state.json";

describe("UI sidecar suspend→resume roundtrip (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
  }, 60_000);

  test("suspend writes the sidecar with the v:9 schema + live UI state", () => {
    const s = h.ui();
    s.activeTrack = 2;
    s.sessionView = true;
    s.beatMarkersEnabled = false;
    s.trackOctave[1] = 2;
    // writeSidecar forces trackActiveBank[activeTrack] = activeBank, so assert a
    // *non-active* track to see the stored value survive verbatim.
    s.trackActiveBank[5] = 3;
    s.trackAtMode[1] = 1;
    s.padLayoutChromatic[1] = true;

    h.suspend();

    const raw = h.files.read(SIDECAR_PATH);
    expect(raw, "sidecar must be written on suspend").not.toBeNull();
    const us = JSON.parse(raw as string);

    expect(us.v).toBe(9);
    expect(us.at).toBe(2);
    expect(us.sv).toBe(1);
    expect(us.bm).toBe(0);
    expect(us.to[1]).toBe(2);
    expect(us.tab[5]).toBe(3);
    expect(us.am[1]).toBe(1);
    expect(us.pchr[1]).toBe(1);
  });

  test("resume restores UI state from the sidecar", () => {
    const s = h.ui();
    s.activeTrack = 3;
    s.sessionView = true;
    s.beatMarkersEnabled = false;
    s.trackOctave[1] = -2;
    s.trackActiveBank[5] = 2; // non-active track (see note above)
    s.trackAtMode[2] = 1;
    s.padLayoutChromatic[1] = true;

    h.suspend();

    // Scribble over everything the sidecar owns, to prove restore (not residue).
    s.activeTrack = 0;
    s.sessionView = false;
    s.beatMarkersEnabled = true;
    s.trackOctave[1] = 0;
    s.trackActiveBank[5] = 0;
    s.trackAtMode[2] = 0;
    s.padLayoutChromatic[1] = false;

    h.resume();

    const r = h.ui();
    expect(r.activeTrack).toBe(3);
    expect(r.sessionView).toBe(true);
    expect(r.beatMarkersEnabled).toBe(false);
    expect(r.trackOctave[1]).toBe(-2);
    expect(r.trackActiveBank[5]).toBe(2);
    expect(r.trackAtMode[2]).toBe(1);
    expect(r.padLayoutChromatic[1]).toBe(true);
  });

  test("first run with no sidecar applies defaults (no-sidecar branch)", () => {
    // Fresh harness already ran init() against an empty FileStore → the
    // restoreUiSidecar else-branch runs: track 0 defaults to the drum pad layout.
    expect(h.files.read(SIDECAR_PATH)).toBeNull();
    expect(h.ui().trackPadMode[0]).toBe(1); // PAD_MODE_DRUM
  });
});
