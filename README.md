# Overture

**One installable groovebox that augments Ableton Move** — sequence Move's own 4 real
Ableton engines (Drift / Wavetable / Drum & Melodic Sampler) *and* up to N open-engine
tracks (any Schwung/moveforge module), under one cohesive UI, from a single install.

Install Overture → it runs on top of Move → you get an 8-track (4 Ableton + 4+ open)
sequencer with a co-run editing mode for the Ableton sounds and the full Schwung module
ecosystem for the rest. Under the hood it bundles Schwung as its (invisible) engine.

> **Status:** early build. The browser emulator runs the real tool UI, real seq8 WASM,
> and browser Schwung-chain audio from Moveforge-built modules. The first
> Overture-native changes (track navigation, clip reveal, auto-routing, Route Check,
> Edit Sound, Param Peek, sound presets, and per-step length) are implemented. The tool
> is a fork of [dAVEBOx](https://github.com/legsmechanical/schwung-davebox); shipped
> behaviour belongs in the manual/generated reference, while new plans should start from
> fresh issues or design notes rather than stale phase roadmaps.

## Docs
- `docs/generated/` — local generated manuals and screenshots from the browser emulator. The directory is gitignored except for `.gitkeep`; regenerate outputs when you want to read or inspect them locally.
  - Beginner guide: `pnpm -C web manual:generate`
  - Reference manual: `pnpm -C web reference:generate`
  - **Accuracy guard:** each figure declares an `expect` (the state/OLED text its caption claims). `pnpm -C web test:e2e` runs `tests/manual-assertions.spec.ts` (ungated), which drives every figure and fails if a behaviour change makes a screenshot or caption wrong. `pnpm -C web manual:check` regenerates both guides and runs the same assertions.
  - **Read locally:** each generator emits standalone `.md` and figure-embedded `.html` files under `docs/generated/`. Generate and open:
    - Beginner: `pnpm -C web manual:generate && open docs/generated/overture-beginner-guide.html`
    - Reference: `pnpm -C web reference:generate && open docs/generated/overture-reference.html`
- `docs/reference/DAVEBOX-MANUAL.md` — the upstream dAVEBOx manual, vendored verbatim as our diff baseline (not a dependency of the manuals above).
- `docs/QUICK-START.md` — first-run setup for the hybrid route model, Schwung slots, track selection, clip reveal, and sound editing.
- `docs/MANUAL.md` — the full Overture tool manual.
- `docs/OVERTURE-DAVEBOX-DIFFERENCES.md` — the precise per-change delta from upstream dAVEBOx.
- `docs/PHILOSOPHY.md` — what Overture is, what it isn't, the principles behind it.
- `docs/ARCHITECTURE.md` — the runtime stack, the monorepo + fork strategy, moveforge, how to modify it.
- `docs/EMULATOR.md` — the browser UX-dev harness (real UI + mocked host/hardware); the first build target.
- `site/src/pages/try.astro` — public "try Overture" route embedding the browser emulator from `web/dist`.
- `docs/ABLETON-ENGINE-ACCESS.md` — the empirical findings on what's reachable in Move's real engines (the foundation).

## Credits / licence
Built on **Schwung** (© Charles Vestal, MIT) and **dAVEBOx** (© Josh Gaines, MIT). Overture
bundles and extends both; all attribution preserved. See those projects' licences.
