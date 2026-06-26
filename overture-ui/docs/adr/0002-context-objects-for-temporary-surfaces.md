# Use Context Objects for temporary blocking surfaces

Temporary blocking surfaces should be represented as Context Objects on the
**UI Context Stack** when they need to own render, jog, and exit handling while
active.

## Context

Overture already has stable ordered render and input handlers for **Track View**,
**Session View**, **Parameter Page**, menus, and co-run. Those orders are
load-bearing and should remain the default behavior.

Some short-lived surfaces behave differently: confirm prompts, modal pickers,
and similar overlays should temporarily capture the OLED, jog rotate/click, and
Back/Menu dismissal, then return control to the previous groovebox surface. This
matches typical groovebox behavior: the base surface stays conceptually
underneath while the temporary surface answers one focused question.

## Decision

Use plain Context Objects on the **UI Context Stack** for temporary blocking
surfaces.

A Context Object may implement:

- `render(surface)`
- `handleJog(event, stack)`
- `handleBack(stack)`

The top Context Object gets first refusal. A handler returns `true` only when it
consumes the render/input/exit action. When the stack is empty, or the top
context does not consume an action, existing ordered handlers continue to own the
UI.

Context Objects own temporary UI priority. Feature modules still own domain
state, commit behavior, cancel behavior, DSP writes, persistence, and side
effects.

The first approved consumer is the Sound Page preset overwrite confirm.

## Non-Goals

The **UI Context Stack** is not a generic screen router or app framework.

Do not migrate these base groovebox surfaces merely because they render or handle
input:

- **Track View**
- **Session View**
- **Parameter Page**
- **Sound Page** itself
- co-run
- live pad workflows
- performance surfaces

## Consequences

New Context Object migrations must include characterization tests for:

- render priority while the context is active;
- jog rotate/click consumption and fallthrough;
- Back/Menu dismissal behavior;
- unchanged behavior when the stack is empty.

This keeps temporary UI ownership local without disturbing the timing-sensitive
and muscle-memory-critical base surfaces.
