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
- Keep Overture-local `overture-ui/ui` imports relative, for example
  `./ui_state.mjs`.
- Keep Schwung shared imports absolute under
  `/data/UserData/schwung/shared/...`.
- Add new `overture-ui/ui` modules to `overture-ui/scripts/bundle_ui.py` in dependency
  order.
- Run full verification before committing:
  - `npm run test:node -- behaviour.test.ts` from `web/`
  - `npm run test:node -- session-view-workflow.test.ts` from `web/`
  - `npm run test:node` from `web/`
  - `python3 scripts/bundle_ui.py` from `overture-ui/`
  - `node --check dist/overture/ui.js` from `overture-ui/`
  - `npm run build` from `web/`
- Commit tool changes first, then commit the parent submodule pointer and
  parent-side tests/docs.

## Completed Slices

- `ui_routes.mjs`: route and motion UI descriptors.
- `ui_sound_edit.mjs`: Edit Sound lifecycle and preflight/handoff state.
- Relative imports for Overture-local `overture-ui/ui` modules.
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
- Loop Step Gesture Workflow extraction for Loop+step A/B window gestures,
  single-step fallback resolution, loop-window writes, and Track View Loop+jog
  length edits.
- Track View Step Workflow extraction started with Copy+step source capture and
  same-clip paste behavior.

## Current Focus

`overture-ui/ui/ui.js` is still large, but several runtime concepts now have earned
module seams. The current focus has moved from Loop Gesture Workflow deepening
to the first Track View Step Workflow slices.

Current Loop Gesture Workflow ownership:

- Loop+step press-time context capture for melodic clip, drum lane, ALL LANES,
  and CC lane contexts.
- Loop+step A/B window gesture calculation, including reversed endpoints.
- Loop+step loop-window writes for melodic clip, drum lane, ALL LANES, and CC
  lane contexts, including mirror updates, page clamping, manual-length flags,
  and pending drum resync for ALL LANES.
- Single-step fallback resolution on start-step release or Loop release.
- Active-recording block for Loop+step edits.
- Track View Loop-held jog length edits for melodic clip, drum lane, ALL LANES,
  and CC lane contexts.

`ui.js` should continue to own:

- top-level MIDI/button handler priority;
- host globals and `host_module_set_param`;
- render invalidation and other legacy adapters.
- shared legacy `S` and adapter calls such as `effectiveClip()`, `copyStep()`,
  `invalidateLEDCache()`, and `forceRedraw()`.

Tests currently covering this seam:

- `web/tests/integration/behaviour.test.ts`
- `web/tests/integration/loop-render.test.ts` for the separate render module

Current Track View Step Workflow ownership:

- Copy + first step captures `{ kind: "step", absStep }` and invalidates LEDs.
- Copy + second step copies source step to target step in the active clip when
  source and target differ.
- Copy + same step preserves existing no-copy refresh behavior.
- Existing non-step `copySrc` is swallowed and does not mix copy kinds.
- Delete + step on melodic normal banks dispatches the active clip step clear.
- Delete + step on melodic CC automation bank clears all knob points in the
  step range and schedules pending CC bits refresh.
- Delete + step on drum tracks clears the active lane step mirror and redraws.
- Mute + step is an explicit fallthrough seam with no separate Track View action.
- Shift + step owns Track View shortcuts for drum perform mode, melodic
  chromatic/in-scale layout, VelIn, melodic TRACK ARP style, double-fill
  dispatch, and quantize-100 writes.
- Normal drum step press owns press-time step edit entry, empty/occupied
  edit-value seeding, tap-window multi-toggle, and held-step gate-span taps.
- Normal melodic step press owns press-time step edit entry, empty/non-empty
  state seeding, CC step-edit activation, chord-first capture, tap-window
  multi-toggle, and held-step gate-span taps.
- Track View step release owns drum tap commit/clear, drum hold-release
  reassign/velocity confirm, melodic tap commit/clear/no-note flash, melodic
  hold-release reassign/reread scheduling, and CC-safe release cleanup.
- Track View step hold-threshold owns tap-window closure, CC step-edit seeding,
  drum empty-step auto-assign/readback, melodic non-empty note/edit readback,
  and melodic empty-step auto-assign/no-note flash.
- Track View chord-first tick handling owns phase 1 empty-step activation,
  pending phase 2 promotion, full-chord note write, held-note refresh, and CC
  bank deferral.
- Track View melodic held-step note assignment owns pad/external-note step
  note toggles/replacement, authoritative note readback, clip mirror updates,
  sequence-note refresh, and redraw.
- Track View melodic non-CC held-step knobs own octave/pitch edits, gate,
  velocity, nudge, iter, probability, ratchet writes, knob touch state, and
  screen-dirty updates.
- Track View drum held-step knobs own gate, velocity, nudge, iter, probability,
  ratchet writes, ignored K4/K8 touch behavior, knob touch state, and
  screen-dirty updates.
- Track View CC-bank held-step knobs own lane selection/touch state, unset
  clear behavior, seed writes, below-zero clears, value clamping,
  `trackCCAutoBits` updates, and step-window tick range writes.

Behavior to preserve:

- Session View step behavior keeps priority before Track View step edits.
- Hold-reveal clip selection keeps priority before Session View and Track View
  step edits.
- Loop gesture behavior keeps priority before Copy/Delete/Mute step edits.
- Copy + step behavior keeps priority before Delete + step when both modifiers
  are held.
- Copy + first step captures a step source and invalidates LEDs.
- Copy + second step copies only when source and target differ, redraws, and
  never mixes step copy with other copy source kinds.
- Mute + step must continue falling through before Shift+step.
- Deeper CC step-edit behavior, Parameter Bank behavior, recording behavior,
  Session View Performance Mode, modal workflows, and unrelated DSP reads/writes
  remain in `ui.js` for now.

Tests currently covering this seam:

- `web/tests/integration/track-view-step-workflow.test.ts`
- `web/tests/integration/behaviour.test.ts`

## Next Slice: Track View Step Workflow

Continue extracting one narrow Track View step-button branch at a time from
`_onStepButtons()`, after characterization coverage and without changing handler
priority. Mute+step is characterized as a fallthrough modifier with no separate
Track View action, and Shift+step shortcuts now live in the Track View Step
Workflow seam. Normal drum and melodic step press handling, step release
commit/cleanup, the tick-side hold-threshold lifecycle, and chord-first tick
phase handling now live in the seam. Melodic held-step note assignment from
pad/external-note input also lives in the seam while live preview, recording,
and MIDI routing remain in `ui.js`. Melodic non-CC held-step knob handling now
also lives in the seam. Drum held-step knob handling now lives in the seam while
CC-bank held-step knob handling also lives in the seam.
The next candidate is another cohesive Track View step-edit cluster; avoid
Parameter Bank behavior and recording behavior until that lifecycle has
characterization coverage.

## Candidate Later Slices

1. Track View Step Workflow.
   - Extract copy/delete/shift/drum/melodic step-button behavior from
     `_onStepButtons()` in small slices.
   - Preserve Session View priority, hold-reveal priority, Loop gesture
     priority, and existing step-edit release behavior.
2. Parameter Bank CC Automation Slice.
   - Start with `activeBank === 6` behavior in `_onCC_knobs()`.
   - Cover alt turn, delete clear, armed recording, stopped resting value, and
     playing audition behavior before moving code.
3. Recording Workflow.
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
