# Context Stack

The context stack is the target owner for modal, overlay, and temporary surface behavior. It should replace scattered flags and duplicated priority checks incrementally.

## Problem

Current modal behavior is fragmented:

- Render priority lives mainly in the screen router.
- Input swallow rules live in MIDI, jog, transport, Back, menu, and feature handlers.
- Back behavior is an explicit list of known surfaces.
- LED behavior is usually inferred from global flags.
- Each modal owns state differently.

This makes new surfaces expensive and risky because they require coordinated edits in multiple ladders.

## Target Context Contract

A context is a runtime object that declares what it owns.

```ts
interface UiContext {
  id: string;
  kind: 'modal' | 'overlay';
  handleEvent?(event: NormalizedInputEvent, env: ContextEnv): ContextResult;
  render?(surface: RenderSurface, env: ContextEnv): ContextResult;
  onBack?(env: ContextEnv): ContextResult;
  onEnter?(env: ContextEnv): void;
  onExit?(env: ContextEnv): void;
}
```

This is the first useful contract, not the final one. The important part is
that temporary ownership, rendering, Back behavior, and lifecycle are declared
in one place. Input capture, LED capture, base contexts, and co-run ownership
should be added only after simple modal contexts have removed real legacy code.

## Stack Semantics

The first stack should contain only temporary contexts:

- zero or more overlays
- zero or one blocking modal at the top

Event routing:

1. Offer Back/render/simple normalized events to the top context.
2. If no context handles it, route to the existing legacy path.
3. Keep legacy priority ladders as fallback until a migrated context deletes a
   real slice of them.

Back behavior:

- Back is routed to the top context first.
- A context may consume Back, pop itself, convert Back into a command, or allow bubbling.
- Global suspend/hide behavior runs only after no context consumes Back.

## Context Types

### Base Contexts

Do not model Track View, Session View, or Performance View as base contexts in
the first migration wave. They are performance-sensitive surfaces with many
DSP, LED, and pad semantics. Keep them as legacy fallback until modal contexts
prove the ownership pattern.

### Overlay Contexts

Overlay contexts add temporary behavior without taking full ownership.

Examples:

- action popup
- param peek
- shift help
- no-note flash
- interval overlay

They usually capture screen partially or not at all, and rarely capture LEDs.

### Modal Contexts

Modal contexts own input until resolved.

Examples:

- confirmation prompt
- snapshot picker
- inherit picker
- clear automation menu
- text keyboard
- route check
- export confirmation

They should define their own cursor state, rendering, commit, cancel, and Back semantics.

### Co-run Contexts

Co-run contexts are special because another UI may own parts of the hardware. They must declare:

- which inputs pass through
- which LEDs are suppressed
- which LEDs are reclaimed on exit
- whether OLED drawing is skipped
- modifier cleanup on enter/exit

Co-run may become a context capability later. It is explicitly not an early
context migration target.

## Critique of Template Context Stack

The template `ContextStack` is a useful starting sketch but insufficient:

- It has no empty-stack behavior.
- It has no capture policy.
- It assumes only the current context matters.
- It does not model Back.
- It does not model LED/OLED ownership separately.
- It does not integrate with command dispatch or DSP timing.

Overture should borrow the stack idea, not the implementation.

## Migration Path

1. Introduce a tiny context stack runtime next to existing flags.
2. Wrap one simple confirm/modal surface while still syncing existing `S` fields
   if needed.
3. Route Back through the stack before the legacy Back ladder only when a
   context is active.
4. Route OLED rendering through the top context before the legacy screen router
   only when a context is active.
5. Convert picker and confirmation surfaces one by one.
6. Add richer capture policies only after two or more contexts need them.
7. Consider co-run only after modal contexts and LED adapter boundaries are
   stable.
