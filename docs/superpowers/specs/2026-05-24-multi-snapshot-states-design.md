# Multi-snapshot save/load states — design

**Date:** 2026-05-24
**Branch:** `multi-snapshot-states`
**Status:** Spec written autonomously (user away). Pending user review on return.

## Goal

Replace the Global Menu's single `Save` action with **`Save state`** + **`Load state`**, backed by up to **16 timestamped, per-set snapshots**. Snapshots are explicit and independent of the existing auto-save. Auto-save on suspend / Quit / Shift+Back is **unchanged**.

This supersedes the old plain `Save` (which force-committed live state to the auto-save file). The new `Save state` still refreshes the auto-save file as a side effect, then copies it into a snapshot, so no force-save capability is lost.

## Decisions (locked with user before they left)

- **Identity:** timestamped snapshots (`MM-DD HH:MM`), shown in a jog-scrollable list.
- **Cap:** 16 per set. Under 16, Save = new snapshot. At 16, Save opens a picker to choose which existing snapshot to overwrite.
- **Overwrite always confirms** ("Overwrite \<label\>? [Yes/No]", No default).
- **Load confirms** ("Load \<label\>? Unsaved changes lost. [Yes/No]", No default) — mirrors the overwrite-confirm safety. *(Decision made autonomously; flagged for veto.)*
- **Incompatible-version snapshots:** confirm-wipe dialog on opening the Load list. *(Autonomous; flagged.)*

## Constraints honored

- **JS-only.** No DSP changes. Deployable via `python3 scripts/bundle_ui.py` (+ `./scripts/install.sh` + reboot when user returns).
- **No `host_list_dir`** dependency — enumeration is manifest-driven.
- **Coalescing-safe** — save reuses the existing deferred `pendingSuspendSave` drain; the snapshot copy is pure file I/O (no `set_param`); load reuses the single `pendingSetLoad` trigger.
- **File-delete** done via `host_remove_dir` on per-snapshot subfolders (no file-delete host API exists).

## Storage layout

Per-set, under the set's UUID folder:

```
set_state/<uuid>/
  seq8-state.json            # live auto-save (unchanged)
  seq8-ui-state.json         # live sidecar (unchanged)
  snap/
    index.json               # manifest
    <id>/seq8-state.json     # snapshot DSP state
    <id>/seq8-ui-state.json  # snapshot sidecar
```

- `id` = save-time epoch ms as a string (monotonic, collision-free).
- Each snapshot in its own `<id>/` subfolder so it can be removed via `host_remove_dir`.

### Manifest schema (`snap/index.json`)

```json
{
  "v": 1,
  "snaps": [
    { "id": "1716557520123", "ts": 1716557520123, "label": "05-24 14:32", "sv": 32 }
  ]
}
```

- `snaps` ordered **newest-first**.
- `sv` = DSP state version at save time (mirrors `"v"` inside the state file).

## Save flow ("Save state")

1. **Guard:** ignore the action if `pendingSuspendSave || pendingSnapshotCopy` is already set (don't race a second snapshot into the same drain slot).
2. **Under 16 snapshots:** allocate new `id`/`label`; set `S.pendingSnapshotCopy = { id, label, overwrite:false }`; call `saveState()` (sets `pendingSuspendSave` + writes sidecar synchronously); close menu; popup `STATE SAVED`.
3. **At 16:** open the snapshot list as an **overwrite picker** (jog to choose which to replace) → on press, confirm `Overwrite <label>?` → on Yes, reuse that entry's `id` (rewrite, new `ts`/`label`), set `pendingSnapshotCopy` with `overwrite:true`, then run the saveState path.
4. **End of tick N:** `pendingSuspendSave` drains → `host_module_set_param('save','1')` → DSP `seq8_save_state` writes live state files **synchronously** (confirmed `seq8_set_param.c:654`).
5. **Tick N+1:** `pendingSnapshotCopy` branch (mirrors `pendingExitAfterSave` at `ui.js:5386`):
   - `host_ensure_dir(snap/<id>)`
   - copy `seq8-state.json` → `snap/<id>/seq8-state.json`
   - copy `seq8-ui-state.json` → `snap/<id>/seq8-ui-state.json` (if it exists)
   - update + write manifest (prepend new entry, or update existing entry on overwrite)

## Load flow ("Load state")

1. Open snapshot list (jog-scrollable, newest-first, showing `label`). Empty list → popup `NO SNAPSHOTS`.
2. Incompatible entries (`sv !== STATE_VERSION`) shown greyed; pressing one is a no-op.
3. On press of a compatible entry → confirm `Load <label>? Unsaved changes lost.` (No default).
4. On Yes:
   - copy `snap/<id>/seq8-state.json` → `seq8-state.json`
   - copy `snap/<id>/seq8-ui-state.json` → `seq8-ui-state.json`
   - set `S.pendingSetLoad = true`
   - The existing reload path (`state_load=UUID` → `pendingDspSync=5` → `syncClipsFromDsp` → `restoreUiSidecar`) restores everything.
   - popup `STATE LOADED`.

## Version-bump incompatibility guard

- Add `STATE_VERSION = 32` to `ui_constants.mjs` with a comment tying it to `dsp/seq8.c` (`v=32`). Future DSP state bumps must touch both.
- On opening the Load list, if any snapshot has `sv !== STATE_VERSION`: show confirm `dAVEBOx updated — N incompatible snapshots will be deleted. Proceed? [Yes/No]` (No default). Yes → `host_remove_dir` each stale `<id>` + drop from manifest. No → keep but greyed/unloadable.

## UI reuse

Model the list + jog selection on the existing inherit picker (`maybeShowInheritPicker` / inherit-picker draw), and the confirm dialogs on the existing `confirmClearSession` pattern.

New `S` fields (ui_state.mjs):
- `snapshotPickerOpen` (bool), `snapshotPickerMode` (`'load'|'overwrite'`), `snapshotPickerSel` (int), `snapshotList` (cached manifest array)
- `pendingSnapshotCopy` (`{id,label,overwrite}` | null)
- `confirmSnapshotLoad` / `confirmSnapshotOverwrite` / `confirmSnapshotWipe` (bool) + matching `*Sel` + target `id`

## Cross-set duplication

`copyStateFiles` (set-duplicate inheritance in `ui_persistence.mjs`) intentionally does **not** copy `snap/`. A duplicated Move set starts with an empty snapshot list. Deliberate — snapshots are per-set working history, not inherited content.

## Files touched (all JS)

- `ui/ui_constants.mjs` — `STATE_VERSION`.
- `ui/ui_state.mjs` — new `S` fields.
- `ui/ui_persistence.mjs` — snapshot path helpers, manifest read/write, `saveSnapshot` / `loadSnapshot` / `deleteSnapshot` helpers.
- `ui/ui.js` — replace `Save` menu item with `Save state` + `Load state`; add `pendingSnapshotCopy` tick-drain branch; picker open/close + jog/press handling; confirm-dialog wiring.
- `ui/ui_dialogs.mjs` — draw snapshot list + confirm dialogs.
- `MANUAL.md` — document the two menu items + snapshot model.
- `notes/CHANGELOG.md` — `[Unreleased] ### Features` entry.

## Device test matrix (deferred — needs ssh + install + reboot when user returns)

1. **Save under cap:** open Global Menu → `Save state`. See `STATE SAVED`. Make an edit, `Save state` again → second entry appears.
2. **Load:** `Load state` → list shows both timestamps newest-first. Pick the older one → `Load … Unsaved changes lost?` → Yes → the older state comes back (clips/notes/config match).
3. **Load cancel:** `Load state` → pick one → No → nothing changes.
4. **Cap at 16:** save 16 times → 17th `Save state` opens overwrite picker → pick one → `Overwrite?` → Yes → that slot updates, count stays 16.
5. **Empty load:** fresh set, `Load state` → `NO SNAPSHOTS`.
6. **Persistence across reload:** save snapshots, Shift+Back, reboot, re-enter set → snapshots still listed and loadable.
7. **Per-set isolation:** snapshots in set A not visible in set B.
8. **(After a future state-version bump)** old snapshots trigger the wipe-confirm on Load-open.
