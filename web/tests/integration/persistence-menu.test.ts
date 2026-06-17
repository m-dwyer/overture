import { describe, test, expect, beforeEach } from "vitest";
import { createHarness, type Harness } from "./harness.js";

// Menu-driven persistence flows: Clear Session, snapshots (Save/Load state), and
// Export — reached through the REAL global menu (Shift+NoteSession → jog
// select/click → confirm dialogs). Drives ui.js end to end and targets the
// menu-gated parts of persist/ui_persistence.mjs (doClearSession, snapshot
// commit/apply/manifest), persist/ui_snapshot_workflow.mjs, and the
// request/confirm entry of persist/ui_export.mjs.

const STATE_PATH = "/data/UserData/schwung/seq8-state.json";
const UI_STATE_PATH = "/data/UserData/schwung/seq8-ui-state.json";
const SNAP_INDEX = "/data/UserData/schwung/seq8-snap-index.json";

describe("menu-driven persistence (real ui.js + seq8-wasm)", () => {
  let h: Harness;
  beforeEach(async () => {
    h = await createHarness();
  }, 60_000);

  test("Clear Session stubs the state files and resets UI state", () => {
    const s = h.ui();
    s.sessionView = true;
    s.beatMarkersEnabled = false;
    s.trackActiveBank[2] = 4;

    h.menuOpen();
    h.menuSelect("Clear Sess");
    h.jogClick();            // action → confirm dialog (default No)
    expect(h.ui().confirmClearSession).toBe(true);
    h.jogTurn(1);            // toggle No → Yes
    h.jogClick();            // confirm → doClearSession

    // State files stubbed to the empty-version sentinel.
    expect(h.files.read(STATE_PATH)).toBe('{"v":0}');
    expect(h.files.read(UI_STATE_PATH)).toBe('{"v":0}');
    // JS state reset to defaults.
    const r = h.ui();
    expect(r.sessionView).toBe(false);
    expect(r.beatMarkersEnabled).toBe(true);
    expect(r.trackActiveBank[2]).toBe(0);
    expect(r.confirmClearSession).toBe(false);
    expect(r.actionPopupLines).toEqual(["SESSION", "CLEARED"]);
  });

  // The seq8 wasm engine keeps its state INTERNALLY — `save` reloads from an
  // in-memory buffer, not a host file (on device the DSP writes seq8-state.json,
  // which the headless wasm build doesn't). So we seed the live state file as a
  // stand-in for that DSP-side write and assert the JS snapshot orchestration:
  // commitSnapshot (manifest + snap files) on Save, applySnapshotToLive (restore
  // the file) on Load. The engine-truth revert is the one device-only piece.
  const STATE_X = '{"v":36,"marker":"SNAP"}';
  const snapStatePath = (id: string) => `/data/UserData/schwung/seq8-snap-${id}-state.json`;

  test("Save state writes a snapshot; Load state restores the saved state file", () => {
    h.files.write(STATE_PATH, STATE_X); // stand-in for the DSP-side save

    h.menuOpen();
    h.menuSelect("Save state");
    h.jogClick();             // action → confirm dialog (default No)
    expect(h.ui().confirmSaveState).toBe(true);
    h.jogTurn(1);             // No → Yes
    h.jogClick();             // → openSaveSnapshot → beginSnapshotSave
    h.step(6);                // drain save (tick N) then commitSnapshot (tick N+1)

    const idxRaw = h.files.read(SNAP_INDEX);
    expect(idxRaw, "snapshot manifest written").not.toBeNull();
    const manifest = JSON.parse(idxRaw as string);
    expect(manifest.snaps).toHaveLength(1);
    const snap = manifest.snaps[0];
    expect(snap.sv).toBe(36); // parsed from the saved state's "v"
    expect(h.files.read(snapStatePath(snap.id))).toBe(STATE_X);

    // Change the live state file, then Load the snapshot back over it.
    h.files.write(STATE_PATH, '{"v":36,"marker":"CHANGED"}');

    h.menuOpen();
    h.menuSelect("Load state");
    h.jogClick();             // openLoadSnapshot → snapshot picker (mode load)
    expect(h.ui().snapshotPicker).toBeTruthy();
    h.jogClick();             // select the snapshot → arm load confirm (default No)
    h.jogTurn(1);             // No → Yes
    h.jogClick();             // → applySnapshotToLive copies snap → live state file
    h.step(2);

    expect(h.files.read(STATE_PATH)).toBe(STATE_X);
  });

  test("Export to Ableton opens the confirm and arms the deferred export", () => {
    h.menuOpen();
    h.menuSelect("Export to Ableton");
    h.jogClick();             // requestExport → confirm dialog (transport stopped)
    expect(h.ui().confirmExport).toBe(true);

    h.jogTurn(1);             // No → Yes
    h.jogClick();             // confirmExportStart → arms pendingExport, popup EXPORTING

    // The packager itself (pollPendingExport phase 2) needs host_system_cmd, which
    // the headless host doesn't provide — so we assert the export was armed, not
    // that a bundle was built.
    expect(h.ui().confirmExport).toBe(false);
    expect(h.ui().actionPopupLines?.[0]).toBe("EXPORTING");
  });
});
