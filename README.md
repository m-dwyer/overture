# Overture

**One installable groovebox that augments Ableton Move** — sequence Move's own 4 real
Ableton engines (Drift / Wavetable / Drum & Melodic Sampler) *and* up to N open-engine
tracks (any Schwung/moveforge module), under one cohesive UI, from a single install.

Install Overture → it runs on top of Move → you get an 8-track (4 Ableton + 4+ open)
sequencer with a co-run editing mode for the Ableton sounds and the full Schwung module
ecosystem for the rest. Under the hood it bundles Schwung as its (invisible) engine.

> **Status:** early build. The browser emulator runs the real tool UI, a mock
> Overture DSP surface, and browser Schwung-chain audio from pinned Moveforge
> WASM modules. The active implementation lives under `overture-next/`; older
> plans and inherited manuals have been removed from the active docs set.

## Docs
- `AGENTS.md` — canonical source-tree and workflow contract for agents.
- `docs/ARCHITECTURE.md` — current active architecture summary.
- `docs/EMULATOR.md` — browser emulator and Moveforge module WASM workflow.
- `docs/DEVICE-SMOKE.md` — minimal on-device checks for changes the emulator cannot prove.
- `docs/adr/` — retained architecture decision history.
- `site/src/pages/try.astro` — public "try Overture" route embedding the browser emulator from `web/dist`.

## Credits / licence
Built on **Schwung** (© Charles Vestal, MIT). See Schwung's licence for its
source and submodule contents.
