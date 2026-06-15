# Overture Refactor Roadmap

This is the temporary execution roadmap for Phase 1 on
`refactor/overture-ui-product-seams`. It exists to keep behavior-preserving
refactor slices tight while `docs/ROADMAP.md` stays focused on product direction.

When Phase 1 is done, fold any durable architecture notes into
`docs/ARCHITECTURE.md` or `docs/ROADMAP.md`, then retire this file.

This file is the execution queue for the current branch. Prefer replacing stale
next-slice sections over appending contradictory plans.

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
  - `npm run test:node -- behaviour.test.ts` from `web/`
  - `npm run test:node -- session-view-workflow.test.ts` from `web/`
  - `npm run test:node` from `web/`
  - `python3 scripts/bundle_ui.py` from `tool/`
  - `node --check dist/overture/ui.js` from `tool/`
  - `npm run build` from `web/`
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
- Pad Surface extraction for pad-map construction, live-note queueing, and
  non-destructive drum performance input.
- Drum Lane Workflow extraction for destructive lane operations.
- Drum Repeat Workflow extraction for repeat pads, latches, and repeat-groove
  helpers.
- Latch Workflow extraction for universal latch clearing.
- Track / Clip Sync extraction for DSP mirror refresh helpers.
- Session View Workflow extraction for step buttons, clip pads, and side rows.
- Track View side-button adapter cleanup for track selection and hold-reveal
  state.
- Loop Step Gesture Workflow extraction for Loop+step A/B window gestures and
  single-step fallback resolution.

## Current Focus

`tool/ui/ui.js` is still large, but several runtime concepts now have earned
module seams. The current focus is deepening `tool/ui/ui_loop_gesture_workflow.mjs`
without broadening it into a generic input handler.

Current Loop Gesture Workflow ownership:

- Loop+step press-time context capture for melodic clip, drum lane, ALL LANES,
  and CC lane contexts.
- Loop+step A/B window gesture calculation, including reversed endpoints.
- Single-step fallback resolution on start-step release or Loop release.
- Active-recording block for Loop+step edits.

`ui.js` should continue to own:

- top-level MIDI/button handler priority;
- host globals and `host_module_set_param`;
- `_fireLoopWindowSet()` / `_fireLoopWindowSetCC()` until moving them would
  shrink the interface rather than widen it;
- render invalidation and other legacy adapters.

Tests currently covering this seam:

- `web/tests/integration/behaviour.test.ts`
- `web/tests/integration/loop-render.test.ts` for the separate render module

## Next Slice: Loop + Jog Gesture Workflow

Extract only the Track View Loop-held jog branch from `_onCC_jog()` into
`tool/ui/ui_loop_gesture_workflow.mjs`.

Behavior to preserve:

- Session View Loop behavior keeps priority before Track View Loop+jog edits.
- Melodic Loop+jog changes active clip length, clamps to the current loop start,
  updates `clipLengthManuallySet`, and writes the same DSP key as today.
- Drum Loop+jog changes active drum lane length, clamps to the current loop
  start, updates `drumLaneLengthManuallySet`, and writes the same DSP key as
  today.
- CC automation bank Loop+jog changes the active CC lane loop length, not the
  clip length.
- Active recording blocks length edits.
- Track View page clamping and redraw behavior stay unchanged.

Tests first:

- Add characterization tests in `web/tests/integration/behaviour.test.ts` for
  melodic Loop+jog, drum Loop+jog, active-recording block, and CC automation
  Loop+jog.
- Prefer engine truth (`get_param`) where the DSP key is readable; otherwise
  assert UI mirror state immediately at the callback boundary and then tick to
  confirm DSP readback where possible.

Refactor:

- Move the Loop-held jog decision and mirror updates behind a narrow workflow
  function.
- Keep `ui.js` as the adapter for host writes, popups, redraw, and handler
  priority.
- Do not move Track View step edit, Parameter Bank behavior, recording behavior,
  Session View Performance Mode, or modal workflows into the Loop Gesture
  Workflow.

## Candidate Later Slices

1. Continue Loop Gesture Workflow.
   - Reassess whether `_fireLoopWindowSet()` and `_fireLoopWindowSetCC()` should
     remain `ui.js` host adapters or move behind the workflow interface.
   - Only move them if the caller interface gets smaller and tests still cover
     all contexts: melodic, drum lane, ALL LANES, and CC lane.
2. Track View Step Workflow.
   - Extract copy/delete/shift/drum/melodic step-button behavior from
     `_onStepButtons()` in small slices.
   - Preserve Session View priority, hold-reveal priority, Loop gesture
     priority, and existing step-edit release behavior.
3. Parameter Bank CC Automation Slice.
   - Start with `activeBank === 6` behavior in `_onCC_knobs()`.
   - Cover alt turn, delete clear, armed recording, stopped resting value, and
     playing audition behavior before moving code.
4. Recording Workflow.
   - Extract arm/disarm/handoff, melodic note queues, drum note queues, and the
     Tick Pipeline drain as a deeper workflow module.
   - Do this after smaller input-workflow seams have reduced `ui.js` enough to
     make ordering easier to see.
5. Remaining Tick Pipeline Slices.
   - Padmap recompute tick gate, DSP inbound padmap self-heal, external MIDI
     queue drain, state-load/DSP sync tasks, overlay expiry tasks, and global
     menu live-preview tick tasks remain valid later work.
   - Each slice should move one coherent timing rule, add tests around the rule,
     and avoid broad UI behavior changes.
