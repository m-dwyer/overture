# Rare suspend crash — non-reproducing

**Observed:** 2026-05-20 during device verification of the saveState() defer fix
(commit on `1.0-tweaks`, this session).

## Symptom

A single crash observed while suspending dAVEBOx (Move home button → suspend
edge, not Shift+Back). Did not reproduce on subsequent suspend/resume cycles.
All other verification steps (Save, Quit, Shift+Back, Shift+Back under load,
Edit Slot..., normal suspend) passed.

## What changed in this session

The suspend edge (`ui/ui.js` ~L4053) used to inline a sidecar `host_write_file`
with a stale v=6 schema, then set `pendingSuspendSave = true`. It now calls
`saveState()` (which writes the unified v=7 sidecar and sets the same flag).
Both paths set `pendingSuspendSave = true` at the same point in tick(), so the
DSP save-set_param drain ordering is unchanged.

Two candidate angles if it resurfaces:

1. **Sidecar schema change side effect.** v=7 carries more fields than the
   old inline write (`pm`/`lm`/`rs`/`us`/`bm`/`ss`/`dva`/`dleu`/`to`). One of
   them could be undefined/non-serializable at suspend-edge timing in some
   rare state (e.g. mid-perf-mod-edit). `JSON.stringify` will throw on
   circular refs but not on undefined; check if any of the slice() / map()
   calls fail when the underlying array is somehow not initialized.

2. **`removeFlagsWrap()` after `saveState()` rather than after the old inline
   write.** Order is the same (save → removeFlagsWrap → ext_midi_remap_enable
   off), but the new path goes through one extra function call frame. Almost
   certainly not the cause but easy to verify if a stack trace surfaces.

## Repro recipe to try if it recurs

- Suspend dAVEBOx via Move home button (not Shift+Back) repeatedly across a
  variety of states: transport playing, recording armed, perf mode active,
  modal dialogs open, mid-knob-turn.
- `ssh ableton@move.local "tail -f /data/UserData/schwung/seq8.log"` during.
- If reproducible: enable JS debug_log around the `saveState()` call at the
  suspend edge to confirm the call completes (don't trust DSP-side
  `host_module_set_param('debug_log', ...)` per the CLAUDE.md note that it's
  unreliable in practice).
