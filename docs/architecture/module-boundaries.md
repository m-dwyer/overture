# Module Boundaries

Overture uses `CONTEXT.md` for domain language and this document for code
ownership. A module boundary should answer: what concept does this module own,
what is public, what is private, and which dependencies are allowed?

## Active Layer Map

- `overture-next/ui/ui.js` is the Schwung compatibility shell. It creates the
  adapter/runtime and installs Schwung entrypoints. Keep it small.
- `overture-next/src/runtime/` owns application orchestration: init, tick,
  runtime readiness, boot splash policy, control-surface input dispatch,
  command draining, and render calls through port contracts.
- `overture-next/src/session-grid.ts` owns neutral Session grid geometry shared
  by control interpretation and view-model derivation.
- `overture-next/src/core/` owns groovebox domain state and decisions: project
  data, transport, control-surface state, control interpretation, domain
  intents, and domain host commands. Keep transient control focus and mode in
  explicit Control State, not in Overture Project data.
- `overture-next/src/host/` owns Schwung/Move translation. Raw `globalThis`,
  Schwung host function names, Move MIDI bytes, Move CC/note numbers, and
  track-to-Move-channel mapping belong here.
- `overture-next/src/ports/` owns typed boundary contracts between runtime,
  host, display, LEDs, MIDI, and command execution. `inbound.ts` names
  hardware/control input contracts, `outbound.ts` names host surfaces Overture
  drives, and `host-ports.ts` composes those contracts for the runtime.
- `overture-next/src/view/` owns view-model data contracts.
- `overture-next/src/render/` is presentational. It renders view models through
  display/LED ports and must not own domain or host policy.

Concrete adapters belong in `src/host/`. The Schwung adapter implements the
`ControlSurfacePort` inbound boundary by converting raw Move MIDI input into
typed control input. Core interprets control input against Control State,
applies resulting intents to project/transport/control state, and emits domain
commands such as `track-note-on` and `track-note-off`; the host adapter converts
those commands to Move or Schwung MIDI through outbound ports.

## Public APIs and Internals

Prefer explicit public entry points for adopted modules. For folder modules,
the public entry point is usually `index.ts`. Private implementation helpers
belong under `internal/` when the module has enough structure to justify it.

Examples:

- `overture-next/src/core/project/index.ts` exposes Project construction and
  lookup APIs; `project/internal/` contains implementation helpers.
- `overture-next/src/core/playback/index.ts` exposes Playback lifecycle APIs;
  `playback/internal/` contains low-level playback helpers.
- `overture-next/src/view/index.ts` exposes view-model derivation contracts;
  `view/internal/` contains view-specific projection helpers.
- `overture-next/src/view/session/index.ts` and
  `overture-next/src/view/track/index.ts` expose view-specific projection
  modules; their `internal/` folders contain the screen and Surface Hint
  projection details.

Code outside an adopted module should import through the public entry point, not
from implementation files or `internal/`.

## Ownership Table

Keep this table current when a boundary changes materially.

| Domain Area | Owner | Public Surface | Private Implementation | Enforcement |
| --- | --- | --- | --- | --- |
| Session grid geometry | `src/session-grid.ts` | Coordinate helpers | None | dependency-cruiser neutrality rule |
| Control input interpretation | `src/core/controls/` | `interpret-control.ts`, `types.ts` | Local private helpers | dependency-cruiser controls/intents rules |
| Domain intent application | `src/core/intents/` | `apply-intent.ts`, `types.ts` | Local private helpers | dependency-cruiser controls/intents rules |
| Project data | `src/core/project/` | `project/index.ts` | `project/internal/` | dependency-cruiser public/internal rules |
| Playback state and lifecycle | `src/core/playback/` | `playback/index.ts` | `playback/internal/` | dependency-cruiser public/internal rules |
| Host translation | `src/host/` | Host adapter and host types | Adapter-local helpers | dependency-cruiser host boundary rules |
| Runtime-host boundary contracts | `src/ports/` | `inbound.ts`, `outbound.ts`, `host-ports.ts` | None | dependency-cruiser ports/runtime rules |
| View models | `src/view/` | `view/index.ts`, `view/<view>/index.ts` | `view/internal/`, `view/<view>/internal/` | dependency-cruiser view/public/internal rules |
| Rendering | `src/render/` | Screen/LED renderers | Local private helpers | dependency-cruiser render rules |

## Boundary Change Checklist

Before changing a boundary:

1. Read the owning module and its imports.
2. Search for outside imports and mutation call sites.
3. Identify whether the current API leaks helpers, internals, or mutable state.
4. Make the smallest change that improves the verified boundary.
5. Update tests through public APIs.
6. Add or tighten ratchets only after the boundary is true.

Before adopting a new module boundary, verify that the module really owns the
concept it names. A new boundary should usually satisfy all three checks:

- it owns the primary type or state shape its public verbs operate on
- it contains domain policy, invariants, or authority reduction that callers
  should not duplicate
- it improves the caller contract rather than only wrapping another module's
  public function

Thin wrappers that import another module's owned type and immediately delegate
back to that owner's public function are usually not a boundary improvement.
Prefer the existing owner API until the new module has a real ownership model.
