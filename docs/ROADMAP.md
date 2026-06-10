# Overture UX Roadmap Implementation Plan

## Summary

Overture is an 8-track hybrid sequencer for Ableton Move: Move engines on tracks
1-4, Schwung/open engines on tracks 5-8, Move-native controls on the surface, and
dAVEBOx sequencing depth preserved underneath.

This roadmap replaces the older phase plan. Earlier work proved the substrate:
the fork builds, the emulator runs the real UI with `seq8`-wasm, side-button
track navigation is implemented, hold-side clip reveal is implemented, co-run
works on device, and melodic note defaults now match Move better. The remaining
product risk is UX: setup clarity, route diagnosis, sound-edit entry, parameter
discoverability, Move-like step editing, and careful upstream catch-up.

Each phase below is intended to be implemented independently on its own branch.
Earlier phases have higher priority.

## Current Product Facts

- Overture is a thick fork of dAVEBOx's `tool/`.
- Side buttons already select tracks in Track View.
- Hold a side button already reveals that track's 16 clips on the step buttons.
- The OLED bank-position strip is implemented.
- Hold step + jog already edits step length.
- Co-run is implemented and device-verified for Move-native and Schwung-chain
  sound editing.
- Move already has native per-step parameter automation, so Overture's automation
  story is not "Move lacks p-locks." The wedge is unified depth: 8 tracks,
  trig conditions, polyrhythmic automation, bake/export, and one timeline for
  Move engines plus Schwung/open tracks.
- Per-track volume is deprioritized: current probes found no clean route to
  Move's native faders from Overture.

## Phase 1: Documentation Reframe And Quick Start

**Priority:** P0
**Branch:** `docs/ux-roadmap-reframe`
**Status:** Done — parent `4c8d180`, tool `f728d28`

Rewrite planning docs around the current product reality.

Changes:
- Rewrite this roadmap around unified hybrid sequencing as the wedge.
- Mark side-button track navigation, hold-side clip reveal, and co-run as already
  implemented.
- Reframe motion/p-locks as unified automation across Move and Schwung, not as
  "Move lacks p-locks."
- Add or update an Overture Quick Start covering Move MIDI setup, Schwung slot
  setup, side-button tracks, clip reveal, and Edit Sound.
- Update `UX.md` with current-vs-target behavior.

Tests:
- Documentation review.
- Verify no doc still describes implemented work as future work.

## Phase 2: Route Check Menu

**Priority:** P0
**Branch:** `feature/route-check`
**Status:** Done — parent `084e546` + `e0c651d`, tool `4c1c72b` + `668723c`

Add a diagnostic Route Check screen without consuming normal Track View header
space.

Changes:
- Add Global Menu item: `Route Check`.
- Show 8 expected routes:
  - `T1 Move Ch1`
  - `T2 Move Ch2`
  - `T3 Move Ch3`
  - `T4 Move Ch4`
  - `T5 Schwung Ch5`
  - `T6 Schwung Ch6`
  - `T7 Schwung Ch7`
  - `T8 Schwung Ch8`
- For Schwung tracks, show detected slot status where possible: `OK Slot1`,
  `NO SLOT`, `THRU!`.
- For Move tracks, show expected channel/manual-check status only unless real
  verification is available.
- Show route warnings contextually during co-run entry or route changes.
- Keep the Track View resting header focused on musical/editing state; do not
  add persistent route identity there.

Tests:
- Emulator tests for Route Check formatting.
- Device check with default routing and at least one mismatch/no-slot case.

## Phase 3: Edit Sound Unification

**Priority:** P0
**Branch:** `feature/edit-sound-unified`

Make co-run feel like one command regardless of route.

Changes:
- Rename user-facing `Edit Slot...` / `Edit Synth...` to `Edit Sound...`.
- Keep route-specific internals:
  - Move route -> Move-native co-run.
  - Schwung route -> Schwung chain editor co-run.
- Add preflight overlays:
  - `EDIT SOUND / T3 Move Ch3`
  - `EDIT SOUND / T5 Schwung Slot1`
  - `NO SLOT / Ch5`
  - `MOVE CH>4`
  - `CO-RUN UNAVAILABLE`
- Preserve Shift+Step 3 as the fast path.
- Update manual entries that still describe co-run as forthcoming.

Tests:
- Emulator tests for menu label, route dispatch, and failure overlays.
- Device test for both co-run targets.

## Phase 4: Upstream dAVEBOx Bug-Fix Port

**Priority:** P1
**Branch:** `upstream/port-low-risk-fixes`

Port low-risk upstream improvements while preserving Overture divergences.

Must port:
- "Clips you left off stay off."
- Save confirmation.
- Chromatic layout persistence fix, if absent.
- Drum lane copy gate-length fix, if absent.
- Drum resync on Shift+jog track switch, if absent.
- Co-run drum pad single-hit/velocity fix, if absent.
- Manual/Quick Start corrections adapted to Overture.

Preserve:
- Side buttons select tracks.
- Hold-side reveals clips.
- Overture branding/import paths.
- WASM/emulator additions.
- DSP refactor layout.

Tests:
- Native build.
- WASM build.
- Emulator integration tests.
- Regression for "focused clip with notes does not auto-launch just because the
  user browsed to it."

## Phase 5: Parameter Discoverability

**Priority:** P1
**Branch:** `feature/param-peek`

Make parameter state legible without requiring users to already know the bank or
gesture.

Changes:
- Add Param Peek on knob touch:
  - bank/context;
  - full label;
  - current value;
  - clip/lane/track/automation/route scope.
- Improve AUTO lane labels: `L1 AT`, `L2 CC74`, `L3 Sch5`, `L4 --`.
- For Move positional automation, use conservative labels like
  `Move K3 current param`.
- Add a compact shortcut/help overlay for major Shift+Step destinations.

Tests:
- Emulator tests for knob-touch rendering.
- Snapshot tests for AUTO labels.
- Regression that knob touch does not mutate values.

## Phase 6: Move-Grammar Step Editing Shortcuts

**Priority:** P1
**Branch:** `feature/move-step-edit-shortcuts`

Add Move-like held-step shortcuts while keeping the K-knob deep editor.

Changes:
- Keep existing Step Edit K controls.
- Add held-step shortcuts:
  - `Shift+jog` = velocity.
  - `Plus/Minus` = melodic pitch transpose.
  - `Left/Right` = nudge.
- Avoid Volume for velocity unless a separate device spike proves no master-volume
  bleed.

Tests:
- Emulator tests for each shortcut.
- Real `seq8.wasm` integration tests for persisted velocity, pitch, and nudge.
- Device test for Shift+jog conflicts.

## Phase 7: AUTO Overview Refinement

**Priority:** P2
**Branch:** `feature/auto-overview-readable`

Improve the existing AUTO bank rather than adding another automation page.

Changes:
- Make AUTO resting view an overview:
  - active track/clip;
  - 8 lanes;
  - assignment label;
  - activity/armed/resting state.
- In AUTO bank, step LEDs show automation for the active lane:
  - off = none;
  - dim = automation exists;
  - bright/pulse = current playhead step.
- Keep normal Track View step LEDs note-focused outside AUTO.
- Add target-confirm wording for future Move positional automation.

Tests:
- Snapshot tests for AUTO overview.
- LED-state tests for active lane automation points.
- Device LED-budget check during playback.

## Phase 8: Hold-Reveal Clip LED Polish

**Priority:** P2
**Branch:** `polish/clip-reveal-leds`

Refine already-implemented hold-side clip reveal.

Changes:
- Make blink timing consistent.
- Ensure states are distinguishable:
  - focused/active;
  - playing;
  - queued/pending stop if represented;
  - has content;
  - empty.
- Prefer fewer clear states over many ambiguous colors.
- Avoid increasing LED traffic beyond budget.

Tests:
- Snapshot tests for reveal states.
- Device test with playing, queued, empty, and content clips.
- Regression that step buttons return to normal after side release.

## Phase 9: Overture Template Set Spike

**Priority:** P3
**Branch:** `spike/overture-template-set`

Investigate whether a preconfigured Move Set can reduce setup friction.

Questions:
- Can install tooling create/copy a Set under `UserLibrary/Sets` that Move
  recognizes?
- Is a database/index update required?
- Can `Song.abl` encode per-track MIDI In channels?
- Can MIDI Out off be encoded?
- Can this be done safely without corrupting user Sets?

Acceptance:
- If reliable, later add install-time template deployment.
- If MIDI channel state is fragile or stored elsewhere, document and abandon
  in-product creation.

## Phase 10: Conductor Evaluation

**Priority:** P3
**Branch:** `research/conductor-fit`

Evaluate upstream dAVEBOx Conductor before porting.

Questions:
- What workflow does Conductor solve?
- Does it fit Overture's hybrid-track simplicity?
- Is it a track type, performance tool, or harmonic lane?
- Can it be documented without burdening first-run UX?

Deliverable:
- Short design note in `overture/docs/`.
- Recommendation to port, reshape, or defer.

## Phase 11: Targeted DSP Maintainability

**Priority:** P3
**Branch:** `refactor/param-dispatch-boundary`

Continue DSP refactoring only where it reduces real change risk.

Changes:
- Implement the parameter dispatch boundary from `SEQ8-REFACTOR-PLAN.md`.
- Keep `seq8.c` as the single compiled translation unit.
- Separate read-only get handlers from mutating set handlers by behavior area.
- Preserve atomic multi-field commands.
- Avoid runtime engine extraction unless required by a concrete feature or bug.

Tests:
- Native build.
- WASM build.
- Emulator integration tests.
- Focused regression for each moved dispatch family.

## Implementation Order

1. `docs/ux-roadmap-reframe`
2. `feature/route-check`
3. `feature/edit-sound-unified`
4. `upstream/port-low-risk-fixes`
5. `feature/param-peek`
6. `feature/move-step-edit-shortcuts`
7. `feature/auto-overview-readable`
8. `polish/clip-reveal-leds`
9. `spike/overture-template-set`
10. `research/conductor-fit`
11. `refactor/param-dispatch-boundary`

## Global Acceptance Criteria

- A new user can configure Move tracks 1-4 and Schwung tracks 5-8 from Overture
  docs.
- Route/setup problems are visible without consuming normal editing screen space.
- Track selection, clip selection, and sound editing feel coherent.
- Common step edits match Move muscle memory.
- dAVEBOx depth remains available but easier to discover.
- Upstream bug fixes are ported without losing Overture's intentional divergences.
