# State Model

The target state model separates ownership before it separates files. The goal is to make each field answer four questions: who owns it, who may mutate it, when it is persisted, and how divergence is reconciled.

## State Categories

### App State

App state is UI-owned, serializable state that describes user focus and non-DSP preferences.

Examples:

- active track
- Session View versus Track View
- scene row
- active bank per track
- selected drum lane
- pad layout, octave, scale, aftertouch mode
- user-facing preferences persisted in the sidecar

App state may be mutated by reducers, workflows, or command mirror effects. It should not contain host handles, render caches, or pending DSP readback counters.

### DSP Mirror State

DSP mirror state is a cached view of audio-engine-owned facts.

Examples:

- clip steps and lengths
- active and queued clips
- playback position
- track mute and solo state
- bank parameters and automation
- recording and merge state
- route/channel state when DSP is authoritative

DSP mirror writes must be treated as optimistic unless they are the result of readback. Any command that updates a mirror must also declare its reconciliation policy.

### Runtime State

Runtime state is process-local and not persisted.

Examples:

- held buttons
- knob touch state
- live-note queues
- recording note matching maps
- pad pressure tracking
- LED caches
- pending host operation queues
- context stack contents

Runtime state should move out of the global singleton first because it often has clear ownership and strong test seams.

### Context State

Context state belongs to the active surface or modal workflow.

Examples:

- snapshot picker cursor
- clear automation menu state
- confirmation prompt option
- text keyboard buffer
- tap tempo state
- route check state
- sound edit page state

The target model stores this inside context objects, not as independent flags on `S`. During migration, context objects may wrap existing `S` fields until callers are moved.

### Render State

Render state is the last rendered or last flushed output.

Examples:

- last screen frame identity
- last sent note LEDs
- last sent button LEDs
- palette initialization status
- screen dirty reason

Render state belongs to render adapters, not feature workflows. Workflows should request invalidation or emit state changes; they should not directly manage caches.

## Store Shape

The long-term state shape should follow ownership, but Overture should not add
empty roots just to look organized. A root such as `S.runtime.recording` or
`S.context.activeModal` is useful only when a concept immediately owns fields
and narrows old access.

Do not introduce broad shells such as `S.app`, `S.dsp`, `S.runtime`, or
`S.sidecar` until the same change moves real fields or the next tightly-scoped
change does. Ownership migration matters more than object nesting.

## Mutation Policy

Preferred mutation paths:

- UI navigation and focus changes: reducers or focused workflow methods.
- Structural musical edits: commands.
- DSP readback: sync modules only.
- Runtime input state: owning input/runtime module only.
- Context state: owning context only.
- Render caches: render adapter only.

Direct writes to arbitrary `S` fields should become legacy adapter behavior. New code should not add top-level fields to `S` unless it is a temporary compatibility bridge.

## State Synchronization

Every DSP-affecting operation should declare:

- DSP write key and payload.
- Whether the UI mirror is updated optimistically.
- Which readback is required.
- Minimum delay before readback, if host timing requires it.
- Render and LED invalidation scope.
- Undo/redo implications.

This policy should live next to the operation, not in unrelated tick code.

## Persistence Boundary

Sidecar persistence should be defined by schema, not by scattered save helpers. The sidecar schema should include only UI-owned facts that must survive set reload:

- focus and view state
- per-track UI preferences
- pad and performance settings not owned by DSP
- active-bank choices

DSP mirror state should not be persisted in the sidecar unless it is intentionally UI-owned fallback state.

## Migration Path

1. Identify a concrete owner before moving any field.
2. Move runtime-only fields for one concept at a time, starting with Recording
   Workflow / Runtime or Pad Surface when related code is touched.
3. Move modal and picker state into context objects as those surfaces migrate.
4. Restrict DSP mirror mutation to sync modules, semantic operations, and
   command mirror effects where those boundaries already exist.
5. Add sidecar schema validation only when a persistence change needs it.
