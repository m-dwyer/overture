# State Ownership

State owners encapsulate mutation for their own state shape. Other modules may
orchestrate workflows, but they should call owner APIs instead of directly
mutating another owner's data.

## Current Owners

| State Shape | Owner | Notes |
| --- | --- | --- |
| `ControlState` | `src/core/control-state.ts` | Owner-object class with `snapshot()` read contract. |
| `TransportState` | `src/core/transport.ts` | Transport timing owner. |
| `PlaybackState` | `src/core/playback/` | Playback lifecycle and note-off scheduling owner. |
| `OvertureProject` | `src/core/project/` | Project data owner and public lookup surface. |

## Preferred Pattern for Newly Adopted Owners

For newly adopted state owners, prefer a stateful owner object such as a class
or closure-backed object over exported mutator functions that accept the owned
state object as a parameter.

Prefer:

```ts
control.selectClipCell(coordinate);
const snapshot = control.snapshot();
```

Avoid adding new APIs shaped like:

```ts
selectClipCell(control, coordinate);
```

Read-only consumers should receive snapshots or narrow read contracts. For
example, control interpretation should read `ControlStateSnapshot` rather than
holding mutation capability for `ControlState`.

## Cross-State Workflows

Cross-state workflows belong in orchestration code. Orchestration may hold
owner objects and call their domain methods, but should not directly mutate
another owner's state shape.

Acceptable orchestration:

```ts
state.control.selectStep(stepIndex);
const sequence = getSequenceForCell(state.project, state.control.snapshot().selectedClipCell);
```

Avoid:

```ts
state.control.selectedStep = stepIndex;
state.playback.pendingNoteOffs.push(noteOff);
```

## Public Contracts

Use public contracts that match caller authority:

- mutation-capable orchestration receives owner objects or public owner APIs
- read-only modules receive snapshots or narrow read contracts
- host/render/view code should not receive mutable domain state when a snapshot
  or view model is sufficient

When a module needs state from another owner, pass the narrowest practical
read-only contract instead of the mutable state object.

## Tests

State-owner unit tests may exercise owner methods directly. Cross-module tests
should prefer public module entry points and should not import `internal/`
helpers.
