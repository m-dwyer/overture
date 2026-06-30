# Overture Architecture

This is the current active architecture summary. `AGENTS.md` remains the
canonical operating contract for agents working in this repo.

For deeper architecture guidance, read:

- `docs/architecture/README.md` for the CONTEXT-to-ratchets workflow.
- `docs/architecture/target-architecture.md` for the feature-first target
  architecture and migration posture.
- `docs/architecture/control-contexts.md` for root views, future pages,
  overlays, and restorable interaction context.
- `docs/architecture/module-boundaries.md` for layer ownership and public API
  boundaries.
- `docs/architecture/state-ownership.md` for mutable state-owner patterns.
- `docs/architecture/ratchets.md` for dependency-cruiser, ESLint, and test
  enforcement policy.

## Active Source Tree

The active Overture implementation is `overture-next/`.

- `overture-next/ui/ui.js` is the Schwung compatibility shell.
- `overture-next/src/runtime/` orchestrates init, ticks, control-surface input dispatch, command draining, and rendering through host port contracts.
- `overture-next/src/shared/` owns neutral shared helpers such as Session grid geometry.
- `overture-next/src/domain/` owns pure musical vocabulary, data shapes, and deterministic domain transforms.
- `overture-next/src/state/` owns mutable state-owner objects such as `ControlSurfaceContext` and `OvertureProject`.
- `overture-next/src/application/` owns core transactions, control interpretation, intent application, transport, playback, read models, and host command contracts.
- `overture-next/src/host/` owns Schwung and Move translation.
- `overture-next/src/ports/` owns typed inbound/outbound boundary contracts and the `OvertureHostPorts` runtime composition.
- `overture-next/src/view/` owns view-model data contracts.
- `overture-next/src/render/` renders view models through display and LED ports.

## Runtime Shape

Overture is a Schwung tool module. It renders UI and produces MIDI/control
commands. It does not currently own a device `dsp.so` or an Overture WASM DSP.

Default routing:

- Tracks 1-4 route to Move engine MIDI targets.
- Tracks 5-8 route to Schwung chain slots.

The browser emulator runs the real Overture UI against a mocked Schwung/Move
host. Schwung module audio in the emulator comes from the pinned `moveforge/`
submodule's browser WASM modules.

## Build Shape

Root tasks are intentionally thin:

- `mise run tool-build` builds the active Schwung tool package from `overture-next/`.
- `mise run moveforge-wasm` initializes `moveforge/` and builds browser WASM module assets.
- `mise run web-build` builds the browser emulator.
- `mise run build` runs the active tool package and emulator build path.
- `mise run tool-deploy` builds and deploys the active Overture tool package through Schwung's installer.
- `mise run deploy` is a lifecycle alias for `tool-deploy`.
- `mise run device-restart` restarts the Move/Schwung stack after deployment.

The Moveforge submodule is pinned for reproducible emulator builds. Advance it
explicitly with `mise run moveforge-update` and review the submodule pointer.

## Decision History

Architecture decisions live in `docs/adr/`. Keep ADRs; prune stale plans rather
than letting them compete with the current source tree.
