# Target Architecture

This is Overture's forward-looking architecture compass. It describes where
feature work should move touched code over time; it is not a mandate for broad
migration before features ship.

## Target Flow

Overture should keep an explicit flow from hardware input to rendered output:

```txt
Hardware Input
  -> Host Adapter
  -> View-aware Control Interpretation
  -> Domain Intent
  -> Core Transaction
  -> Owned State Changes + Host Commands
  -> Core Read Model
  -> View Model
  -> LED / Display / Debug Renderers
```

This is a DDD-flavored modular monolith: durable musical state lives in core
domain modules, host/runtime edges are adapters, and UI control behavior is
state-machine-shaped by the active view and Control Surface Context.

## Durable Musical Hierarchy

`OvertureProject` is the durable musical root: the user-authored state that
should eventually serialize into an Overture Project document and load back
without depending on the current runtime session.

Durable Project data includes:

- Tracks and Track Routes
- Overture Scenes
- Clip Cells and their Clip occupancy
- Overture Clips
- Sequences and Steps owned by Clips
- later Motion, route-specific data, and retained inactive route data

Project owns durable musical state and the Selected Clip Cell cursor — the
active-clip pointer into its grid, which persists with the Project. It must not
own other transient interaction or playback context such as the current view,
held modifiers, playing state, playhead, or pending note-offs. Track Selection
and visible Track Bank are derived from the cursor rather than owned.

## Transient Owners

Control Surface Context owns transient surface mode: current view/control mode,
held modifiers, and Track View page/parameter context. The Selected Clip Cell
cursor is owned by Project; Track Selection and visible Track Bank are derived
from it. Control interpretation should read `ControlSurfaceContextSnapshot`, not
mutation-capable Control Surface Context.

Transport owns timing and play/stop state. Playback owns playing Clip IDs,
pending note-offs, and scheduling lifecycle. Cross-state workflows belong in
core orchestration, which may call owner interfaces but should not directly
mutate another owner's state shape.

## View Context and Surface Hints

Track View, Overture Session View, and future views should increasingly own
their view-specific input interpretation and Surface Hint derivation. The active
view decides what a pad, button, encoder, or modifier means in the current
context.

Prefer view-owned interpreters and hint projections when behavior becomes
view-specific. Avoid growing one central conditional tree for every view.

Surface Hints are read-only projections from Control Surface Context, Project read
contracts, and view context. They preview possible Domain Intents for LEDs,
display, or other surfaces; they are not mutation handles.

## Read Models and Persistence

Owner-local `snapshot()` methods are read contracts for a single owner, such as
Control Surface Context or Transport.

The app-facing core snapshot is a Core Read Model: data for view-model
derivation, LEDs, display, and debug state. It may combine durable Project data
with transient control, transport, and playback facts, so it is not a
persistence format.

Project persistence should be a Project-owned document contract:

```ts
serializeProject(project): ProjectDocument
loadProject(document): OvertureProject
```

Persist durable musical data first. If restoring UI/session context becomes
valuable, keep it separate from the Project document unless a product decision
makes it part of the saveable musical artifact.

## Feature-First Migration

Implement features first, then move touched code one step toward this target
when the feature creates real pressure in that area.

Examples:

- Save/load work should introduce Project document serialization.
- New views should move input interpretation and Surface Hints toward
  view-owned modules.
- Clip creation or duplication should deepen Project write contracts.
- Route editing or route conflict warnings should deepen route-related Project
  or Track interfaces.
- Playback changes should introduce narrow read contracts only around the
  workflow being changed.

Do not pause feature delivery for broad architecture migration. Split cleanup
into its own commit when it grows beyond the feature's touched area.

## Interface Depth

Deepen a module interface only when it concentrates real policy, invariants,
copying, validation, lookup rules, or authority reduction. Use the deletion
test: if deleting the module would spread that knowledge across callers, the
module is earning its keep.

Avoid thin wrappers that only delegate to another owner's public function or
return raw fields without owning a meaningful contract.

## Ratchets

Dependency-cruiser, ESLint, and tests should ratchet architecture only after
the desired shape is already true. Ratchets describe adopted constraints, not
aspirations.

Likely ratchets over time:

- adopted module internals stay private
- public imports go through module entry points
- owned mutable state is mutated only by its owner
- view/render consume read models or view models, not mutable core owners
- direct Project field reads outside Project are restricted after Project read
  contracts cover real callers without thin wrappers
