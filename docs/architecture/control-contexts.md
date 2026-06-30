# Control Contexts

Overture keeps **Overture Session View** and **Track View** as product and
domain language. Internally, those views are also root control contexts: the
long-lived interaction contexts that decide what the Move surface means when no
more specific context is capturing input.

This note describes the intended control-context model for adding more screens,
root-view pages, parameter-bearing pages, and later modal workflows without
turning all interaction state into durable Project data.

## Context Types

**Root View Context**:
The active top-level view selected by the physical Session/Note button. The
current root views are Overture Session View and Track View. Existing code names
this state `activeView`; keep that name until a focused migration justifies
renaming it.

**Page Context**:
A selected page within a root view, such as a Track View parameter page for a
sound engine, envelope, or FX component, or a future Session View performance
page. Page context is interaction state. It may choose how encoders, pads, the
jog wheel, or buttons are interpreted while that page is selected. Not every
root-view page is a parameter page.

**Overlay Context**:
A modal, picker, confirmation, or transient editor that captures above the root
view while open. Add an overlay stack only when the first real overlay workflow
needs it.

**Global Control**:
A control intentionally interpreted before the active context. Global controls
must be explicit. Do not assume every transport, modifier, or view-switching
control bypasses overlays; decide that per control when overlays exist.

**Restorable Interaction Context**:
Optional UI/session state that may be saved and restored separately from durable
musical Project data. Examples include the selected root view, selected
root-view page, or selected parameter on a parameter-bearing page.

## Interpretation Order

The current behavior is:

```txt
ControlInput
  -> explicit global control interpretation
  -> active root view control interpretation
  -> DomainIntent | null
```

When overlays are introduced, the intended order is:

```txt
ControlInput
  -> explicit global control interpretation
  -> top overlay control interpretation, if present
  -> active root view or page control interpretation
  -> DomainIntent | null
```

The overlay step should be added only with a real modal or picker feature. Until
then, root view contexts are enough.

## Ownership

`ControlSurfaceContext` owns transient interaction state: active root view,
selection, visible Track Bank, held modifiers, selected Step, and future selected
page/editor context. Read-only consumers should use snapshots.

Durable musical data remains owned by Project and related domain/state owners.
Parameter values, route data, clips, scenes, and Motion should not move into
`ControlSurfaceContext` just because a page displays or edits them.

Track View now owns the minimum useful page interaction state:

```ts
trackView: {
  selectedPageId: RootViewPageId;
  selectedParameterIdByPage: Record<RootViewPageId, ParameterId>;
}
```

This remembers the selected Track View page and the selected parameter for each
Track View page. The page identity is intentionally root-view vocabulary, not
parameter-page vocabulary, so future non-parameter pages can use the same
concept. Expose mutation through `ControlSurfaceContext` owner methods.

Do not make `ControlSurfaceContext` the registry of available pages. Page
availability likely depends on view definitions, route/component metadata,
Project data, or host/module capabilities. `ControlSurfaceContext` should
remember the current interaction context; concrete page metadata should live
with the feature that owns it.

## Persistence

Persist restorable interaction context separately from durable Project data. A
future persistence shape may serialize selected root-view pages or parameters,
but it should validate restored values against the current Project/module shape
and fall back gracefully if a page or parameter no longer exists.

Do not add a persistence schema as part of the control-context refactor. Add it
when save/load or restore behavior creates concrete requirements.

## Migration Sequence

1. Refactor control interpretation to select a root control context without
   changing behavior.
2. Add minimal Track View page context as restorable interaction state.
3. Add page-specific interpretation and view projection with a concrete page
   feature, passing narrow read contracts instead of broad snapshots where
   practical.
4. Add overlay context capture only when a modal or picker exists.
5. Add restorable interaction persistence separately from Project musical data.
