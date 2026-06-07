# Overture

**One installable groovebox that augments Ableton Move** — sequence Move's own 4 real
Ableton engines (Drift / Wavetable / Drum & Melodic Sampler) *and* up to N open-engine
tracks (any Schwung/moveforge module), under one cohesive UI, from a single install.

Install Overture → it runs on top of Move → you get an 8-track (4 Ableton + 4+ open)
sequencer with a co-run editing mode for the Ableton sounds and the full Schwung module
ecosystem for the rest. Under the hood it bundles Schwung as its (invisible) engine.

> **Status:** design/planning. This repo currently holds the architecture, philosophy, and
> roadmap. The tool itself starts as a fork of [dAVEBOx](https://github.com/legsmechanical/schwung-davebox)
> (which already implements ~80% of this) — see `docs/ROADMAP.md`.

## Docs
- `docs/PHILOSOPHY.md` — what Overture is, what it isn't, the principles behind it.
- `docs/ARCHITECTURE.md` — the runtime stack, the monorepo + fork strategy, moveforge, how to modify it.
- `docs/ROADMAP.md` — the phased build plan (emulator-first) ← start here.
- `docs/UX.md` — the UX brief: principles, mode/navigation model, the motion-lane flagship, co-run "zoom".
- `docs/EMULATOR.md` — the browser UX-dev harness (real UI + mocked host/hardware); the first build target.
- `docs/HYBRID-GROOVEBOX.md` — the deep in-tool design reference (track model, routing, display, FX, perf, fragility).
- `docs/ABLETON-ENGINE-ACCESS.md` — the empirical findings on what's reachable in Move's real engines (the foundation).

## Credits / licence
Built on **Schwung** (© Charles Vestal, MIT) and **dAVEBOx** (© Josh Gaines, MIT). Overture
bundles and extends both; all attribution preserved. See those projects' licences.
