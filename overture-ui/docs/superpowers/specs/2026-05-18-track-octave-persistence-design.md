# Track-octave persistence — sidecar v=7

**Date:** 2026-05-18
**Status:** Approved approach (sidecar); awaiting spec review
**Parked item:** `per-track-octave-ux`
**Branch:** `1.0-tweaks` (second fix in the batch)

## Problem

`S.trackOctave[t]` is an 8-slot array (one per track), driven by the OCTAVE +/- buttons. Within a session it's per-track and the OLED indicator + pad-press + DSP padmap all reference the same authoritative value, so adjustments are accurate.

But the array is initialized to `[0,0,0,0,0,0,0,0]` at module load (`ui_state.mjs:172`) and **never saved** — it's absent from `ui_persistence.mjs:saveState()` and from `restoreUiSidecar()`. Every module reload / set switch / device reboot resets all 8 tracks to oct=0, so any per-track offsets the user dialed in get wiped.

**MANUAL.md already documents octave shift as a per-track persisted setting** (`docs/MANUAL.md:216` lists it under Per-track scope, and L1378 lists it under "What persists per set"). So this fix brings code into alignment with documented behavior — it's a fix, not a new feature.

## Goal

Persist `S.trackOctave[]` across module reloads, set switches, and reboots — using the existing sidecar JSON file (`seq8-ui-state.json`).

## Non-goals

- No DSP-side mirror of `trackOctave` or DSP state version bump. `trackOctave` is consumed by JS at pad-dispatch time (`ui.js:7106/7177`) and at padmap-build time (`ui.js:1412`); DSP receives the resolved padmap with octave already baked in, so it never needs the raw value.
- No new gestures (no Shift+OCTAVE "sync-all", no copy-paste hint, no visual treatment). Those were design options canvassed and dropped — user wants persistence only.
- No defaults migration. Older sidecars (v ≤ 6) just keep the JS-init defaults (zeros) for the new field.

## Architecture

Single-field sidecar bump. Three sites touched in `ui/ui_persistence.mjs` and `ui/ui.js`.

### Save site (`ui/ui_persistence.mjs:saveState()`)

```js
host_write_file(uuidToUiStatePath(S.currentSetUuid), JSON.stringify({
    v: 7,                                                      // was 6
    at: S.activeTrack, ac: S.trackActiveClip.slice(), sv: S.sessionView ? 1 : 0,
    dl: S.activeDrumLane.slice(),
    pm: S.perfModsToggled, lm: S.perfLatchMode ? 1 : 0,
    rs: S.perfRecalledSlot, us: S.perfSnapshots.slice(8),
    bm: S.beatMarkersEnabled ? 1 : 0,
    ss: S.trackSchwungSlot.slice(),
    dva: S.drumVelZoneArmed.slice(),
    dleu: S.drumLaneEuclidN.map(function(lane) { return lane.slice(); }),
    to: S.trackOctave.slice()                                  // new (v=7)
}));
```

### Restore site (`ui/ui.js:restoreUiSidecar()`)

Add a new gated block after the existing `us.v >= 6` block (around line 3544):

```js
if (us.v >= 7 && Array.isArray(us.to)) {
    for (let _t = 0; _t < NUM_TRACKS; _t++) {
        const _o = us.to[_t];
        if (typeof _o === 'number')
            S.trackOctave[_t] = Math.max(-4, Math.min(4, _o | 0));
    }
}
```

Clamp on read so a malformed file (whether user-hand-edited or corrupted) can't put pads outside the legal range.

### Save-trigger site (OCTAVE +/- handlers)

OCTAVE +/- currently sets `S.screenDirty = true` after writing `trackOctave[activeTrack]` but doesn't trigger a save. Per `MANUAL.md:1372` ("State is **not** saved continuously during use"), the codebase pattern is suspend-only sidecar save (via `saveState()` called from Shift+Back / Quit / Global Menu → Save). Power loss between adjust and suspend = work lost, but that's the established baseline for every other per-track setting too (mode, route, channel, VelIn, Looper).

**Choice: match the existing pattern.** No per-press save. `trackOctave` rides along on whatever save path the user already triggers. The MANUAL.md L1372 disclaimer covers the loss case; treating octave specially would be inconsistent with how every other Per-track setting behaves.

If the user wants per-press persistence later, the change is one line: add `saveState();` to both OCTAVE +/- handlers. Easy to add; documented escape valve.

### Defaults (no-sidecar / v < 7)

Older sidecars (v=1..6) hit the new restore block's gate and skip it. `S.trackOctave` stays at the `ui_state.mjs:172` init value (`[0,0,0,0,0,0,0,0]`). No-op for everyone upgrading from a prior version — first reload after upgrade = clean zeros, future presses persist.

### Clear-session reset

`doClearSession()` at `ui_persistence.mjs:144` currently doesn't touch `trackOctave`. Add: `for (let _t = 0; _t < NUM_TRACKS; _t++) S.trackOctave[_t] = 0;` in the per-track loop. Otherwise Clear Session leaves the JS-side array dirty while the sidecar is wiped — a subtle UI/state mismatch.

## Risk

- **Power loss between adjust and suspend:** consistent with every other Per-track setting; covered by MANUAL.md's "not saved continuously" disclaimer. User must Shift+Back / Quit / hit Save to persist. Same posture as channel / route / mode / VelIn / Looper.
- **Old v=6 sidecars overwritten on next save with v=7:** by design. Once the user saves once, the sidecar is v=7 forever. No way back to v=6 without manual file deletion. Acceptable per pre-public posture.
- **Clamp on read:** malformed `to[_t]` (non-number, NaN, out-of-range) gets dropped (`typeof === 'number'` check) or clamped (`Math.max(-4, Math.min(4, _o | 0))`). Worst case: a non-number entry leaves that track at its current value (which on fresh load = 0).

## Testing matrix (verify on Move)

| # | Setup | Action | Expected |
|---|-------|--------|----------|
| 1 | Fresh session (oct=0 everywhere) | Set track 1 to +2, track 2 to -1, save (Shift+Back to suspend) | sidecar JSON contains `"to":[2,-1,0,0,0,0,0,0]` and `"v":7` |
| 2 | After test 1 | Full reboot of Move | After re-entry to dAVEBOx, track 1 OLED shows Oct:+2, track 2 shows Oct:-1, pads play accordingly |
| 3 | Old v=6 sidecar exists | Edit one track's octave | Sidecar bumps to v=7; other v=6 fields preserved (active track, perf mods, etc.) |
| 4 | Clear Session | After clear | All tracks reset to oct=0; OLED reads "Oct:0" for every track |
| 5 | Per-track adjust without saving | Adjust track 3 to +1, then force-reboot (skip Shift+Back) | Track 3 reverts to 0 on re-entry — consistent with "not saved continuously" baseline. Same outcome you'd see for any other per-track setting (channel, route, mode) under the same scenario. |
| 6 | Set switch (Move-side set duplicate) | Adjust octaves in set A, duplicate to set B | Set B's sidecar inherits A's `to` values via existing `copyStateFiles()` path |

## Implementation steps

1. Already on `1.0-tweaks` (carrying the delete+play commit). No new branch.
2. Edit `ui/ui_persistence.mjs`:
   - Bump `v: 6` → `v: 7` in `saveState()` JSON.
   - Add `to: S.trackOctave.slice()` field.
   - Add `for (let _t = 0; _t < NUM_TRACKS; _t++) S.trackOctave[_t] = 0;` to `doClearSession()`.
3. Edit `ui/ui.js`:
   - Add `if (us.v >= 7 && Array.isArray(us.to)) { ... }` block in `restoreUiSidecar()` (after the existing `us.v >= 6` block, around line 3544).
4. Bundle: `python3 scripts/bundle_ui.py`.
5. Deploy + reboot Move.
6. Run the 6-row matrix from the verification batch at end of `1.0-tweaks`.
7. CHANGELOG entry under `[Unreleased] → ### Fixes`.
8. No MANUAL.md changes — documentation already promises this behavior (L216 + L1378). Fix brings code into alignment with docs.
9. Commit as `fix:` — completing pre-existing partial behavior.

## CHANGELOG entry (draft)

```
- **Per-track octave shift now actually persists per-set, matching the manual.** MANUAL §14.2 has long listed "octave shift" as a Per-track setting that persists per set, but the `trackOctave` array was JS-only — it never made it into the sidecar, so every module reload / set switch / reboot reset all 8 tracks to oct=0. The 8-slot array now saves to `seq8-ui-state.json` (bumped to v=7) on the existing suspend/Quit/Save path and restores on entry. Older v=6 sidecars stay readable — they just keep the JS-init zeros for the new field until the user saves with the new build. Clear Session resets all 8 tracks to 0 alongside the rest of the cleared state.
```

## Out of scope (parked, separate items)

- Sync-all-tracks gesture (Shift+OCTAVE pushes active track's octave to all 8)
- Visual treatment when active track's octave differs from others
- Copy-paste hint when clip moves between tracks at different octaves

Park these until the user surfaces them again — persistence alone may resolve the underlying friction without any further UX work.
