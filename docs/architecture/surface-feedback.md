# Surface Feedback

The Move control surface is **always** a projection of the current composed
state. Every lightable control resolves to an LED state from the active view,
selection, playback, and any held-modifier overlay. A control that is dark is a
control no layer chose to light, not a control with no defined state.

This note describes the layered surface compositor, the per-owner read contracts
that feed it, and where new policy (precedence) and new state (active notes,
track colour, held inputs) belong as the surface becomes fully alive.

## The compositor already exists

`view/overture-view.ts` `createLedView` is the compositor, and
`view/session/internal/pad-leds.ts` already resolves layered precedence
(`queued > playing > queued-stop > hinted > selected > occupied > empty`) for
Session View pads. This work **completes layers and read contracts**; it does not
introduce a new compositor.

## Feedback layers

Each control's final LED state is the topmost layer that contributes a state for
it. Layers, lowest precedence first:

| Layer             | Driven by                           | Owner read contract                                                               |
| ----------------- | ----------------------------------- | --------------------------------------------------------------------------------- |
| Identity baseline | Project data + active view          | clip occupancy (`clipCellSnapshots`), Track colour (planned)                      |
| Selection         | Project cursor (Selected Clip Cell) | `ControlSurfaceContextSnapshot` (composes the cursor)                             |
| Playback          | Playback + Transport                | playhead (`TransportSnapshot`), **active notes** (`PlaybackSnapshot.activeNotes`) |
| Overlay / hints   | Control Surface Context held inputs | held modifiers, held pad (planned)                                                |

The compositor reads snapshots from each owner and composes. It owns **no state**;
this matches ADR-0003 (core owns state, view derives, render presents).

## Affordance vs Surface Hint vs control address

The overlay layer is fed by **affordances**, not by hand-authored hints. Three
distinct concepts, in three layers:

- **Control address** (`application`, input side): the single physical control a
  press would hit — a Track button, a Pad, a Step. Versatile; covers every
  control. Essentially a `ControlInput` minus press-time data.
- **Surface Affordance** (`application`): `{ trigger: ControlAddress; intent:
DomainIntent }`. Carrying the real `DomainIntent` makes a hint for an intent
  that does not exist unrepresentable — the compiler rejects it. The same value
  is what `interpret` would return for that press, so preview and action cannot
  drift.
- **Surface Hint** (`view`, output side): the data-carrying visual preview a
  Surface Region renders. A hint may light one control or many, and carries
  resolved data (a target Track colour, a "root note" role). The view owns the
  affordance-to-hint projection, including coarsening a single-control trigger to
  a region.

A Surface Hint is the top layer, not a separate pipeline. Holding a modifier (or
a pad) restyles the surface from the affordances of the relevant controls plus
domain state.

## Precedence is compositor-owned policy

"Does the moving playhead override the selected-step highlight? Does a held-shift
preview override the baseline Track colour?" These precedence rules are real
policy and belong to the compositor (the view), not smeared across owners. The
existing `pad-leds.ts` precedence chain is the first instance; keep precedence
decisions there as layers are added.

## Single source of truth for sounding notes

"Light the pad for the note length" must reflect what is actually sounding, not a
re-derivation of gate timing in the view. `Playback` owns the note lifecycle, so
it exposes `activeNotes()` (notes on but not yet off, from the note-gate
scheduler). The same state that drives `track-note-off` to the host drives the
pad LED, so the lit pad and the sounding note cannot disagree.

The Track View pad grid is the audition note layout (`shared/track-pad-layout.ts`,
`noteForTrackPad`), shared by control interpretation and view projection so the
pad/note mapping has one home.

## Roadmap

1. **Playback layer for Track View pads** — `Playback.activeNotes()` +
   `note → pad` projection lights sounding notes for their gate length. _(done)_
2. **Identity baseline** — Track View pads light a `playable` baseline in the
   selected **Track Colour** (owned Project identity, route-neutral, defaulted per
   Track Index; render maps the colour index to a Move LED byte), and the shared
   track-row (side) buttons light each visible Track's colour at rest in both
   views _(done)_. Session View pad-grid identity colouring remains pending.
3. **Press feedback** — held-pad interaction state in `ControlSurfaceContext`
   (`pressPad`/`releasePad`/`heldPads`, carrying velocity), updated by the audition
   operation, lights pressed pads over the baseline _(done)_.
4. **Overlay/hints** — each root control context owns `interpret` +
   `affordances`; `SurfaceAffordance { trigger: ControlAddress; intent }` carries
   a real Domain Intent, so `Surface Hint`s derive centrally from the snapshot's
   affordances and the phantom `scene-launch-target` hint is gone by construction
   _(done)_. Still to come on this layer: rendering the Sound-page (step) hint,
   and data-carrying hints (e.g. bank hints showing the target Track's colour).
5. **Held-pad context overlays** — chromatic/scale overlays project from pad
   affordances and the existing held-pad state once melodic vs drum Track types
   are modelled.
