# State Ownership

State owners encapsulate mutation for their own state shape. Other modules may
orchestrate workflows, but they should call owner APIs instead of directly
mutating another owner's data.

## Current Owners

| State Shape             | Owner                                  | Notes                                                                                                                                                                                                                  |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ControlSurfaceContext` | `src/state/control-surface-context.ts` | Owns transient surface mode (active view, held controls/pads, Track View page/parameter). `snapshot(selectedClipCell)` composes the active-clip cursor in; Track Selection and visible Track Bank are derived from it. |
| `OvertureProject`       | `src/state/project.ts`                 | Durable owner of Tracks, Scenes, Clip Cells, Overture Clips, and the Selected Clip Cell cursor. Vends a scoped `ClipEditor` for the active clip; a `Sequence` entity owns its Steps.                                   |
| `TransportState`        | `src/application/transport.ts`         | Owner-object class with `snapshot()` and `clock()` read contracts.                                                                                                                                                     |
| `PlaybackState`         | `src/application/playback/`            | Playback lifecycle and note-off scheduling owner.                                                                                                                                                                      |

## Preferred Pattern for Newly Adopted Owners

For newly adopted state owners, prefer a stateful owner object such as a class
or closure-backed object over exported mutator functions that accept the owned
state object as a parameter.

Prefer:

```ts
project.selectClip(coordinate);
const snapshot = control.snapshot(project.selectedClipCell());
```

Avoid adding new APIs shaped like:

```ts
selectClip(project, coordinate);
```

Read-only consumers should receive snapshots or narrow read contracts. For
example, control interpretation should read `ControlSurfaceContextSnapshot`
rather than holding mutation capability for `ControlSurfaceContext`.

## Cross-State Workflows

Cross-state workflows belong in orchestration code. Orchestration may hold
owner objects and call their domain methods, but should not directly mutate
another owner's state shape.

Acceptable orchestration (a genuine cross-owner workflow — Project cursor plus
Playback launch):

```ts
state.project.selectClip(coordinate);
state.playback.requestClipToggle(state.project, coordinate, timing);
```

Single-owner edits stay on the owner that holds the state, not threaded across
owners:

```ts
state.project.activeClipEditor()?.toggleStep(stepIndex);
```

Avoid reaching past an owner's API into its data:

```ts
state.project.data.selectedClipCell = coordinate;
```

Workflow orchestration should avoid passing broad composition objects into
lower-level workflows. Prefer narrow context objects or explicit parameters
that match the workflow's required authority.

Prefer:

```ts
runWorkflow({ durableOwner, interactionOwner }, command);
```

Avoid:

```ts
runWorkflow(applicationState, command);
```

## Public Contracts

Use public contracts that match caller authority:

- mutation-capable orchestration receives owner objects or public owner APIs
- scoped intent handlers and workflow modules receive narrow workflow contexts,
  not broad core state
- read-only modules receive snapshots or narrow read contracts
- host/render/view code should not receive mutable domain state when a snapshot
  or view model is sufficient

When a module needs state from another owner, pass the narrowest practical
read-only contract instead of the mutable state object.

## Tests

State-owner unit tests may exercise owner methods directly. Cross-module tests
should prefer public module entry points and should not import `internal/`
helpers.
