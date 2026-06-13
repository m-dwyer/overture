# Overture Roadmap

## Product Direction

Overture is an Overture-native groovebox for Ableton Move: one fast, cohesive
surface for sequencing Move engines on tracks 1-4 and Schwung/open engines on
tracks 5-8, with dAVEBOx depth preserved underneath.

Overture should not feel like vanilla dAVEBOx with a few renamed menus, and it
does not need to clone vanilla Move when a different choice is clearer or
faster. Use Move gestures where they are already good, but optimize for:

- beginner-friendly first session;
- fast daily music-making;
- readable OLED and LED context;
- fewer menu dives;
- power features that reveal themselves from track, clip, step, sound, and
  motion contexts.

The working mental model is:

- **Perform:** play clips, select tracks, mute/solo, record, use variations.
- **Shape:** edit steps, clip length, probability, ratchets, automation/motion.
- **System:** routing, Schwung slots, templates, export, diagnostics, state.

Menus are for setup and deep settings. Musical actions should be reachable from
the object they affect.

## Completed Baseline

The following work is already part of the baseline and should not remain as
active roadmap phases:

- Overture is a thick fork of dAVEBOx's `tool/`.
- The browser emulator runs the real tool UI with `seq8.wasm`.
- Side buttons select tracks in Track View.
- Shift + side buttons select tracks 5-8.
- Holding a side button reveals that track's 16 clips on the step buttons.
- The OLED bank-position strip is implemented.
- Hold step + jog edits step length.
- Route Check exists.
- Edit Sound exists and unifies Move-native and Schwung-chain co-run entry.
- Param Peek exists, including human-readable CC/AT/Schwung labels.
- Low-risk upstream dAVEBOx fixes have been ported.
- Emulator integration tests cover the current track, route, co-run, and Param
  Peek behavior.

Per-track Move volume remains deprioritized. Current probes found no clean route
to Move's native faders from inside Overture without master-volume bleed or
foreground-control problems.

## Phase 0: Upstream Schwung v0.9.18 Migration

**Priority:** P0
**Branch:** `infra/upstream-schwung-0.9.18`

Replace the temporary co-run-patched Schwung path with upstream Schwung
`v0.9.18` or newer. Co-run is now upstream, so Overture should not keep carrying
a Schwung fork solely for co-run.

Changes:

- Update the integrator repo to prefer upstream Schwung for the host/shim layer.
- Remove or mark legacy temporary co-run bridge tasks and scripts.
- Keep Overture capability-gated for older or stock hosts:
  `typeof shadow_corun_begin === 'function'`.
- Verify `shadow_corun_begin`, `shadow_corun_end`, and
  `shadow_corun_state` behavior against the upstream host.
- Preserve the current `tool/` fork as the main product divergence.

Acceptance:

- Overture launches against upstream Schwung `v0.9.18` or newer.
- Edit Sound works for Move-routed tracks and Schwung-routed tracks.
- Route Check still detects Schwung slots.
- Emulator tests pass.
- Device smoke test confirms co-run entry and exit for both targets.

## Phase 1: Overture UI Product Seams

**Priority:** P0
**Branch:** `refactor/overture-ui-product-seams`

Refactor only where it creates leverage for the Overture-native UX. The goal is
not more files; the goal is deeper modules with smaller interfaces.

Create focused modules around these product concepts:

- **track surface:** active track, track bank, hold-side clip reveal, track
  labels.
- **sound edit:** route-specific Edit Sound dispatch, preflight wording, co-run
  state.
- **route health:** Move/Schwung channel and slot checks.
- **motion:** AUTO lane labels, Param Peek, automation context.
- **shortcut layer:** Shift+Step commands and discoverability.
- **LED language:** shared track, clip, route, co-run, and automation meanings.

Rules:

- Preserve behavior while extracting.
- Keep `S` as the backing state for now; do not attempt a full state rewrite.
- Do not split code unless the new module hides real complexity behind a smaller
  interface.
- Add or move tests with each extracted behavior.
- Avoid touching DSP unless a refactor exposes a real DSP contract bug.

Acceptance:

- No intentional user-visible behavior changes.
- Existing integration tests pass.
- New tests cover `sound edit`, `route health`, and `motion` formatting through
  the same interfaces the UI uses.
- Future UX work should not need to modify unrelated areas of `ui.js`.

## Phase 2: Setup Health And Template Spike

**Priority:** P1
**Branch:** `feature/setup-health-template-spike`

Reduce first-run confusion. A beginner should be able to tell whether Overture
is ready to make sound and what to fix when it is not.

Changes:

- Evolve Route Check into Setup Health.
- Check Schwung version and co-run capability.
- Check Move track route/channel expectations for tracks 1-4.
- Check Schwung slots/channels for tracks 5-8.
- Detect obvious thru, missing-slot, and channel-mismatch cases.
- Investigate install-time template deployment using `Song.abl`, Schwung set
  state, and Track Presets.
- Keep all template probing read-only until the exact write path is proven safe.

Questions:

- Can install tooling create or copy a Set under `UserLibrary/Sets` that Move
  recognizes?
- Is a database/index update required?
- Can `Song.abl` encode the needed track MIDI setup, or is that state elsewhere?
- Can the Schwung slot state be safely associated with a template Set?
- Can this be done without corrupting user Sets?

Acceptance:

- Setup Health gives actionable user messages, not debug labels.
- No user Set is modified during the spike.
- Findings are documented with exact files and paths tested.
- If reliable, add a follow-up implementation phase for template deployment.
- If fragile, document the manual setup path and keep Setup Health as the guide.

## Phase 3: Move-Style Step Editing Shortcuts

**Priority:** P1
**Branch:** `feature/move-step-edit-shortcuts`

Make common step edits fast without removing dAVEBOx depth.

Changes:

- Keep the existing Step Edit K controls.
- Add held-step shortcuts:
  - `Shift+jog` = velocity.
  - `Plus/Minus` = melodic pitch transpose.
  - `Left/Right` = nudge.
- Avoid Volume for velocity unless a device spike proves no master-volume bleed.
- Make OLED feedback clear while each shortcut is active.

Acceptance:

- Real `seq8.wasm` tests confirm velocity, pitch, and nudge persist.
- Existing step-edit trig controls still work.
- No accidental bank cycling while holding a step.
- Device test confirms shortcut conflicts are acceptable.

## Phase 4: Motion Layer Readability

**Priority:** P1
**Branch:** `feature/motion-layer-readable`

Make AUTO feel like musical motion, not a debug bank. Keep the existing AUTO
power, but make lane assignment, scope, and activity easier to read.

Changes:

- Reframe AUTO docs and UI copy as `Motion` where possible without breaking
  current muscle memory.
- Improve the resting AUTO/Motion overview:
  - active track and clip;
  - lane assignments;
  - activity, armed, and resting state;
  - route and scope.
- In AUTO/Motion bank, step LEDs show automation for the active lane:
  - off = none;
  - dim = automation exists;
  - bright or pulse = current playhead step.
- Keep Param Peek honest:
  - known CC names and Schwung labels are allowed;
  - Move-routed lanes fall back to `Move target` until actual Move parameter
    names are proven.

Acceptance:

- Snapshot tests cover overview screens.
- LED tests cover lane activity states.
- Device test checks LED traffic during playback.
- Knob touch and turn remain fast and do not require menu navigation.

## Phase 5: Shortcut Layer And Menu Demotion

**Priority:** P2
**Branch:** `feature/shortcut-layer-menu-demotion`

Make Overture less menu-divey. The Global Menu should become a system/deep
settings surface, not the main way to make music.

Changes:

- Define the active command map for Perform, Shape, and System.
- Audit Global Menu items and move common musical actions to Shift+Step or
  context gestures where appropriate.
- Keep Global Menu for deep, rare, or setup actions.
- Update the Shift+Step help overlay with the current command map.
- Keep any moved command available somewhere discoverable until the replacement
  gesture is tested.

Acceptance:

- A command map exists in docs.
- Global Menu is shorter and grouped by purpose.
- Common musical actions have direct gestures.
- Tests cover command routing for moved actions.

## Phase 6: LED Language And Clip Reveal Polish

**Priority:** P2
**Branch:** `polish/led-language-and-clip-reveal`

Make the hardware surface readable at a glance.

Changes:

- Document a shared LED language:
  - track identity;
  - active track;
  - playing, queued, content, and empty clip;
  - muted and soloed;
  - recording and armed;
  - motion present or recording;
  - co-run active;
  - setup warning.
- Polish hold-side clip reveal using that language.
- Prefer fewer unmistakable states over many subtle states.
- Respect the LED write budget.

Acceptance:

- LED language is documented.
- Clip reveal has distinct states for focused/active, playing, queued, content,
  and empty.
- Step LEDs return correctly after side release.
- Device test checks readability and LED budget.

## Phase 7: Move Parameter Name Discovery Spike

**Priority:** P3
**Branch:** `spike/move-param-name-discovery`

Determine whether Move-routed Motion lanes can show actual Move parameter names.

Questions:

- Can parameter names be derived live from Move UI, display text, logs, runtime
  state, or another observable channel?
- Can they be read from `Song.abl` reliably enough?
- Are stock device parameter maps stable enough for a fallback table?
- Would user aliases help or create maintenance burden?

Acceptance:

- Document every discovery path tested.
- If reliable, add a follow-up implementation phase with data model and
  invalidation rules.
- If not reliable, keep fallback wording honest.
- Do not ship guessed Move parameter names as facts.

## Phase 8: Performance / Variations Reframe

**Priority:** P3
**Branch:** `research/performance-variations-reframe`

Make dAVEBOx Performance Mode easier to understand and fun to use without
removing its power.

Changes:

- Evaluate whether Performance Mode should be reframed as `Variations`,
  `Perform`, or another musical concept.
- Keep the existing mod-grid power.
- Improve OLED and pad feedback so pressing a pad clearly communicates the
  result.
- Decide whether factory presets should be beginner-facing.

Acceptance:

- Design note explains the chosen mental model.
- Existing performance behavior is preserved.
- Tests cover mode entry/exit and preset recall.

## Phase 9: Conductor Evaluation

**Priority:** P3
**Branch:** `research/conductor-fit`

Decide whether upstream dAVEBOx Conductor belongs in Overture.

Acceptance:

- Short design note recommends port, reshape, or defer.
- The recommendation explains where Conductor fits in Perform, Shape, or System.
- Do not port it if it steepens the beginner path without a clear payoff.

## Phase 10: Targeted DSP Maintainability

**Priority:** P3
**Branch:** `refactor/param-dispatch-boundary`

Continue DSP refactors only where they reduce real change risk.

Changes:

- Implement the parameter dispatch boundary from `SEQ8-REFACTOR-PLAN.md` if it
  is needed by active UX work or bug fixes.
- Keep `seq8.c` as the single compiled translation unit unless a later phase
  explicitly changes that.
- Separate read-only get handlers from mutating set handlers by behavior area.
- Preserve atomic multi-field commands.
- Avoid runtime engine extraction unless required by a concrete feature or bug.

Acceptance:

- Native build passes.
- WASM build passes.
- Emulator integration tests pass.
- Focused regression exists for each moved dispatch family.
- DSP state version is unchanged unless persisted format changes.

## Phase 11: Quality Gates

**Priority:** P4
**Branch:** `quality/lint-static-analysis`

Add lint and static analysis only where signal is high.

Changes:

- Keep `tsc --noEmit`, `pnpm test:node`, and emulator tests as primary gates.
- Tighten ESLint around real risks:
  - unsafe `any` at module interfaces;
  - stale React hook dependencies;
  - unhandled promises;
  - unused eslint-disable comments.
- Spike C static analysis only after UX-facing work stabilizes.
- Keep noisy tools non-blocking until the tree is clean under the chosen rules.

Acceptance:

- Checks are documented.
- No noisy blocking tools are added.
- Quality work does not force unrelated refactors.

## Implementation Order

1. `infra/upstream-schwung-0.9.18`
2. `refactor/overture-ui-product-seams`
3. `feature/setup-health-template-spike`
4. `feature/move-step-edit-shortcuts`
5. `feature/motion-layer-readable`
6. `feature/shortcut-layer-menu-demotion`
7. `polish/led-language-and-clip-reveal`
8. `spike/move-param-name-discovery`
9. `research/performance-variations-reframe`
10. `research/conductor-fit`
11. `refactor/param-dispatch-boundary`
12. `quality/lint-static-analysis`

## Global Acceptance Criteria

- A new user can get to a working hybrid setup without understanding Schwung
  internals first.
- Route/setup problems are visible and actionable without consuming the normal
  playing/editing screen.
- Track selection, clip selection, sound editing, and motion feel like one
  instrument.
- Common edits are fast and do not require menu diving.
- The OLED always answers: what track/clip am I on, what am I editing, and what
  happens if I turn or press something?
- dAVEBOx depth remains available and easier to grow into.
- Schwung divergence is minimized; Overture product divergence lives primarily
  in `tool/`.
