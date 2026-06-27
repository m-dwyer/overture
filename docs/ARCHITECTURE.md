# Overture Architecture

This is the current active architecture summary. `AGENTS.md` remains the
canonical operating contract for agents working in this repo.

## Active Source Tree

The active Overture implementation is `overture-next/`.

- `overture-next/ui/ui.js` is the Schwung compatibility shell.
- `overture-next/src/runtime/` orchestrates init, ticks, command draining, and rendering.
- `overture-next/src/core/` owns project state, transport, control interpretation, playback, and host commands.
- `overture-next/src/host/` owns Schwung and Move translation.
- `overture-next/src/ports/` owns typed boundary contracts.
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
