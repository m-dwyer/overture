# Overture Refactor Roadmap

This is the temporary execution roadmap for Phase 1 on
`refactor/overture-ui-product-seams`. It exists to keep behavior-preserving
refactor slices tight while `docs/ROADMAP.md` stays focused on product direction.

When Phase 1 is done, fold any durable architecture notes into
`docs/ARCHITECTURE.md` or `docs/ROADMAP.md`, then retire this file.

## Rules

- Inspect current code before proposing or editing.
- Add or strengthen tests before refactoring.
- Keep behavior unchanged unless a bug is explicitly called out and covered.
- Keep Overture-local `tool/ui` imports relative, for example
  `./ui_state.mjs`.
- Keep Schwung shared imports absolute under
  `/data/UserData/schwung/shared/...`.
- Add new `tool/ui` modules to `tool/scripts/bundle_ui.py` in dependency
  order.
- Run full verification before committing:
  - `pnpm -C web test:node`
  - `pnpm -C web typecheck`
  - `python3 scripts/bundle_ui.py` from `tool/`
  - `mise run smoke`
  - `pnpm -C web build`
- Commit tool changes first, then commit the parent submodule pointer and
  parent-side tests/docs.

## Completed Slices

- `ui_routes.mjs`: route and motion UI descriptors.
- `ui_sound_edit.mjs`: Edit Sound lifecycle and preflight/handoff state.
- Relative imports for Overture-local `tool/ui` modules.
- `ui_route_check.mjs`: Route Check view model.
- `ui_motion.mjs`: AUTO/Motion view models and Param Peek descriptors.
- `ui_tick_tasks.mjs`: Move co-run tick injection, deferred content resync
  drains, end-of-tick persistence drain.
- Drum NOTE FX Param Peek correction: drum K1/K2 describe lane note editing
  instead of melodic Octave Shift.
- Default set-param drain extraction:
  `pendingDefaultSetParams`, `clearDrainHold`, `pendingSetLoad`,
  `pendingDspSync`.

Recent commits at the time this file was added:

- tool `fd4501b`: extract default set param drain
- parent `c926bde`: cover default set param drain
- tool `b29a30a`: fix drum note fx param peek
- parent `83a80fd`: cover drum note fx param peek
- tool `23f94a1`: extract tick task drains
- parent `c9099b5`: cover tick task drains

## Current Focus

`tool/ui/ui.js` is still large, but the tick drains now have a clear home in
`tool/ui/ui_tick_tasks.mjs`.

Existing tick helpers:

- `runDefaultSetParamDrain`
- `runMoveCoRunTickTasks`
- `runDeferredContentResyncTasks`
- `runEndOfTickPersistenceTasks`

Tests currently covering this seam:

- `web/tests/integration/tick-tasks.test.ts`
- real harness coverage in `web/tests/integration/tool.test.ts`

## Next Slice: Padmap Recompute Tick Gate

Extract the early-tick `pendingPadNoteMapRecompute` gate from `tool/ui/ui.js`
into `tool/ui/ui_tick_tasks.mjs`.

Behavior to preserve:

- No-op when `pendingPadNoteMapRecompute` is false.
- No-op while `pendingDefaultSetParams.length > 0`.
- No-op while `clearDrainHold > 0`.
- When clear, set `pendingPadNoteMapRecompute = false` and call
  `computePadNoteMap()` exactly once.
- Keep the call in the same early-tick location, before live-note drain,
  remap, and session-view edge checks.

Tests first:

- Unit seam tests in `tick-tasks.test.ts` for all gate cases.
- Add a real harness check only if practical without overfitting internals:
  keep a queued default param present for one tick and verify recompute waits
  until after the queue drains.

Do not combine this slice with the DSP inbound self-heal block. The self-heal
reads DSP state and has patched-Schwung capability gates, so it should remain a
separate later slice.

## Candidate Later Slices

- DSP inbound padmap self-heal block:
  `dspInboundEnabled`, muted edge detection, `pad_dispatch_muted`, and
  `pad_note_map_0` readbacks.
- External MIDI queue drain:
  `extSendAsyncEnabled` gate and `ext_queue` USB-A send.
- State load / DSP sync tasks:
  `pendingSetLoad`, `pendingDspSync`, instance nonce hot-reload.
- Live note and drum note-off drains:
  preserve one-set-param-per-track timing and step-op deferral.
- Overlay expiry tasks:
  bank select timeout, action popup timeout, Param Peek detail tick, no-note
  flash, step-save flash.
- Global menu live-preview tick task:
  edit-value apply and xpose preview self-heal.

Each slice should move one coherent timing rule, add tests around the rule, and
avoid broad UI behavior changes.
