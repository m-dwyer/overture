# Migration Strategy

Overture should migrate toward the target architecture by ratcheting existing
seams, not by running a broad platform rewrite. The target vocabulary is:

- **Contexts** own temporary interaction layers.
- **Commands / Operations** perform user-visible changes.
- **Models** describe presentation.
- **Runtimes / Facades** protect stateful or timing-sensitive invariants.
- **Adapters** isolate host, hardware, DSP, file, and render boundaries.

This document is the migration source of truth. Prefer updating it over adding
parallel roadmap, ranking, or transformation-plan documents.

## Ground Rules

- Preserve existing behavior unless a feature or fix explicitly changes it.
- Keep `ui.js` as the explicit composition root: host callbacks, runtime
  construction, host capability binding, and delegation.
- Do not add passive architecture shells. A new abstraction must replace a real
  path, capture a real invariant, or become an immediate Boy Scout rule.
- Do not add empty state roots. Move fields only when a concept takes ownership.
- Do not mechanically rename legacy `bank` code or DSP protocol identifiers.
- Avoid new generic `workflow` names unless the module truly owns a multi-step
  user flow. Prefer Context, Command, Operation, Model, Runtime, Facade,
  Renderer, or Adapter.
- Every compatibility bridge must name the old path it replaces and the next
  follow-up that can delete or narrow the bridge.

## Phase 0: Architecture Ratchet

Make the existing docs and tests point in one direction before moving more
runtime code.

Deliverables:

- Keep the current-state and concept docs as reference material.
- Keep `dsp-write-readback-inventory.md` current when DSP write policy changes.
- Explicitly reject for now: plugin registry, broad ScreenFrame/LedFrame
  conversion, empty nested state roots, and command-wrapping every input.
- Treat architecture work as Boy Scout work unless a focused refactor is
  explicitly approved.

## Phase 1: UI Context Ownership

Introduce context ownership only for temporary blocking surfaces first.

Initial scope:

- Add a tiny `UiContextStack` for modal-style ownership.
- First migrated context should be a simple confirm/modal surface.
- Context v1 owns render, Back, and simple event handling for that modal.
- Preserve existing `S` flags as compatibility state during migration.
- Route render and Back through the stack only when the stack is non-empty.

Do not start with Track View, Session View, Sound Page, text entry, or co-run.
Those surfaces carry more performance, host, and pass-through behavior than the
first context migration should own.

## Phase 2: Parameter Page Convergence

The Parameter Page concept already exists. This phase strengthens it; it does
not create a new subsystem.

Foundation:

- `ui/components/ui_parameter_page.mjs`
- `ui/core/ui_parameter_page_model.mjs`
- `ui/render/ui_parameter_page_render.mjs`
- shared `ParameterPageModel` / `ParameterPageGridModel` types

Migration rule:

- When touching a Page or rendered bank, prefer extending the shared Parameter
  Page model/render contract.
- Classify Page render paths as shared Parameter Page, specialized Parameter
  Page overview, or mode-owned screen.
- Keep rendering identical unless the change is explicitly a UX change.
- Do not broaden this into a mechanical conversion of every legacy bank.

## Phase 3: Hardware Event Normalization

Normalize hardware input when there is a real consumer, usually a migrated
context.

Initial event shape:

- raw source bytes
- control kind
- id / index
- action
- value / delta
- modifier snapshot when needed

Keep raw MIDI dispatch behavior unchanged at first. Route normalized jog,
click, and Back to the active context before legacy handlers. Do not turn raw
MIDI, held-button state, pad pressure, live notes, render invalidation, or
co-run pass-through into commands.

## Phase 4: DSP Protocol, Queue, And Commands

DSP timing is a core architecture boundary. Preserve hardware timing before
improving shape.

Migration rule:

- When touching DSP writes/readbacks, classify the operation using
  `dsp-write-readback-inventory.md`.
- Add protocol helpers for one write family at a time.
- Route deferred writes through the compatibility DSP operation queue only when
  tests prove current timing is preserved.
- Introduce command descriptors only for user-visible state changes with DSP,
  mirror, undo, readback, or invalidation policy.

Command v1 may include:

- id / category / label
- DSP operations
- undo policy
- optional mirror patch
- readback request
- invalidation and status feedback

The first production command in any family must delete or encapsulate duplicated
legacy policy. Do not use commands for transient input or low-latency
performance dispatch.

## Phase 5: Managed State By Ownership

Move state when ownership becomes real.

Preferred ownership buckets:

- DSP Mirror: reconciled through Track / Clip Sync.
- Interaction State: context stack, active modal/browser/text entry.
- Input Runtime State: held controls, pad press/touch state.
- Presentation State: status flash, touched param, focused feedback.
- Persistence State: UI Sidecar fields.

Recording is an early candidate because it spans input, tick drains, DSP writes,
and readback. Pad Surface and Parameter Bank runtime are also good ownership
anchors because they already exist.

## Phase 6: Broaden After Proof

Expand only after earlier slices have removed real coupling.

Good follow-ups:

- additional modals and browsers as contexts
- more Page render paths through Parameter Page models
- more DSP write families through protocol helpers or semantic operations
- undoable structural edits through commands after queue timing is covered
- recording queue ownership behind Recording Runtime / Workflow boundaries

Delay until justified:

- co-run context ownership
- broad render or LED frame conversion
- sidecar schema registration
- plugin-style feature registry
- base Track View / Session View as contexts

## Test Strategy

- Run `pnpm -C overture-ui verify` before every commit.
- Add characterization tests before moving risky behavior.
- Context tests assert ownership: top modal consumes render/jog/Back, empty stack
  falls through unchanged.
- Parameter Page tests assert model assembly, focused feedback, empty/unavailable
  states, and render parity.
- Event tests assert raw MIDI maps to normalized events without changing dispatch
  order.
- DSP/command tests assert exact key/payload parity, queue drain timing, undo
  policy, mirror patches, readback scheduling, and invalidation.
- Keep integration tests as safety net. Do not add broad brittle integration
  tests for every seam.

## Boy Scout Checklist

When touching code:

- Modal/browser: can this surface move toward `UiContextStack`?
- Page/rendered bank: can this strengthen the shared Parameter Page contract?
- DSP write/readback: has the operation been classified and tested?
- Undoable edit: should this become a Command / Operation boundary?
- `ui.js`: can behavior move out while preserving explicit composition?
- State field: does a concept now own this field strongly enough to move it?
