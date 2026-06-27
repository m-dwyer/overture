# Overture Next Architecture Deepening Plan

This plan records the near-term architecture work for `overture-next/`. It is
not a replacement for reading the code before each change; it is the ordering
anchor for reducing churn while the control, intent, playback, and view seams
deepen.

## Goal

Preserve the current layered shape while making the active Overture pipeline
deep enough for modifiers, view-local control behavior, surface hints, and
future undo/redo:

1. Host adapter parses raw Move MIDI into Hardware Input.
2. Core interprets Hardware Input with Control State and view-local context into
   a Domain Intent.
3. Core applies the Domain Intent as an explicit transaction.
4. The transaction mutates Overture-owned state and emits Host Commands.
5. View derives screen and LED models, including future surface hints, from
   snapshots.
6. Render and host adapters map those models and commands to Schwung/Move.

## Phase 1: Domain Intent Transaction

Status: complete

Deepen `core/intents` so applying a Domain Intent is an explicit transaction,
not a direct mutation plus a caller-owned Host Command array.

Expected outcome:

- Intent application has one result object for applied/no-op status, emitted
  Host Commands, and later undo/render metadata.
- Core owns command accumulation through transaction results.
- Tests exercise intent behavior through the transaction seam.

## Phase 2: Control State Focus Invariants

Status: complete

Deepen Control State so selection and focus changes are expressed as operations
instead of direct field mutation.

Expected outcome:

- Track Selection, Selected Clip Cell, visible Track Bank, selected Step, held
  modifiers, and control mode stay internally consistent.
- Domain Intent application asks Control State to perform focus transitions.
- Tests stop manufacturing invalid Control State except through explicit fixture
  helpers.

## Phase 3: Hardware Input Interpretation

Status: complete

Deepen the Hardware Input interpretation module so modifiers and view-local
behavior are owned in one place.

Expected outcome:

- Move MIDI parsing remains in the host adapter.
- Overture interpretation owns Hardware Input + Control State + view context to
  Domain Intent.
- Track View, Overture Session View, step buttons, pads, side buttons, and
  right-hand buttons can evolve without scattering modifier policy.

## Phase 4: Surface Hints

Status: complete

Name and model the visual hints shown while modifiers are held.

Expected outcome:

- `CONTEXT.md` has a domain term for hinted control combinations.
- View models can represent hinted pads, steps, and buttons without render or
  host code knowing why they are hinted.
- Shift and future modifiers can preview possible Domain Intents in tests.

## Phase 5: Playback Scheduling

Status: next

Deepen playback so it owns Playing Clip, Queued Clip, Launch Boundary, note
emission, and stop policy.

Expected outcome:

- Transport advances time; playback decides the musical events that result.
- Clip Launch and Scene Launch behavior can add launch quantization without
  spreading timing policy across core and intent application.
- Stuck-note and launch-boundary behavior are testable through playback-facing
  behavior tests.

## Phase 6: Snapshot-Only External Core Interface

Status: planned

Stop leaking mutable Core State through runtime and host seams.

Expected outcome:

- Runtime and host adapters consume snapshots or explicit debug projections.
- Raw mutable Core State remains an implementation detail of core.
- Future undo/redo state can change shape without breaking host/runtime code.

## Test Direction

Focused unit tests should stay close to module interfaces. Broader workflow
tests should drive the real pipeline: Hardware Input enters core/runtime, Domain
Intent transactions mutate state and emit Host Commands, snapshots feed view
models, and render/host adapters are checked at their own seams.
