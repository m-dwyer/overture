# Overture — Architecture

Deep in-tool design (track model, routing, display/state, FX, performance, fragility) lives in
`HYBRID-GROOVEBOX.md`. This doc covers the **product/packaging architecture**: the runtime stack,
the repo shape, the fork strategy, and how you modify each layer.

## Runtime stack (what runs on the Move)
```
Move firmware (MoveOriginal) ── owns SPI, hosts the 4 Ableton engines
   ▲  (MIDI_IN mailbox / framebuffer)
Schwung shim (LD_PRELOAD)    ── intercepts SPI; injects MIDI; mixes audio; co-run; hosts modules
   ▲
Overture tool module + Schwung slots
   • Overture tool  = the sequencer + UI (a fork of dAVEBOx)
   • Schwung slots  = the open-engine tracks (moveforge modules, with FX + sends + master FX)
```
Everything is **MIDI-routed**: Overture sequences notes/expression to (a) Move's tracks via
inject (cable 2, by channel) and (b) Schwung slots; the slots and Move produce the audio.
Overture itself renders **no audio** (like dAVEBOx).

## Repo shape — current and target

Current repo shape:
```
overture/                         ← integrator repo
├── tool/      submodule → m-dwyer/schwung-davebox  (THICK fork = the Overture tool)
├── scripts/   integration/deploy helpers
├── web/       emulator and tests for the real tool UI
└── docs/
```

Target packaging shape:
```
overture/                         ← integrator repo (m-dwyer/overture, PRIVATE)
├── schwung/   optional submodule or pinned checkout → upstream charlesvestal/schwung
├── tool/      submodule → m-dwyer/schwung-davebox  (THICK fork = the Overture tool; upstream=legsmechanical/…)
├── modules/   submodule(s) → curated default open modules to ship
├── build.sh   builds patched shim + shadow_ui + the tool + bundles modules
├── install.sh deploys the whole stack to MOVE_HOST (move-em.local) in one command
├── overture.json  branding / default set / boot behaviour
└── docs/
```
The monorepo owns the **glue** (submodule pins, build/install, default-module bundle, config,
branding) — *not* Schwung or tool source; it references your forks at specific commits.
`git clone --recursive && ./install.sh` = the single-package experience.

> **Private note:** GitHub can't *privately fork* a public repo. The `schwung`/`tool` submodules
> are **private mirrors** (`gh repo create m-dwyer/X --private`; push upstream in; add `upstream`
> remote for pulls), not `gh repo fork`s.

## Fork strategy (asymmetric on purpose)
- **Schwung = upstream-first.** Co-run should come from the first verified
  upstream Schwung tag or pinned commit that contains it. Prefer a plain
  upstream pin unless Overture needs a tiny capability-gated host hook. Any host
  fork should be thin, tracked to upstream releases, and treated as integrator
  tax.
- **`tool` = THICK fork.** This is your product. Diverge freely for Overture-native
  UX: track surface, sound edit, route health, motion, shortcut layer, LED
  language, setup, and performance flow. Over time it stops tracking dAVEBOx
  closely and becomes simply Overture.

**Why asymmetric:** every line in `schwung` is rebased forever; lines in `tool` are just yours.
Concentrate ownership in code you *want* to own; touch the host as little as possible.

## Versioning and upstream lineage
Overture package versions are independent from upstream dAVEBOx versions. The
installed module advertises Overture's version through `tool/module.json` and
`tool/release.json`; dAVEBOx catch-up status is tracked in `docs/UPSTREAM.md`.
Do not bump the DSP state version for upstream-port bookkeeping or UI-only
changes.

## How you modify each layer
- **Modify the tool:** edit in `tool/` → commit → push your fork → bump the pointer in `overture`.
  Normal git; this is most of your work.
- **Modify Schwung only when a host capability is genuinely required:**
  1. edit in `schwung/` → commit → push your fork;
  2. **rebuild *both* the shim *and* shadow_ui** (host changes need both — the capability gate checks
     the running `shadow_ui` binary, not the shim);
  3. **capability-gate the new API in the tool** (`typeof shadow_xxx === 'function'`) so it degrades
     on stock Schwung;
  4. bump the `schwung` pointer.
- **Track upstream Schwung:** `git fetch upstream` in `schwung/` → rebase your (small) commit set
  onto the new tag → rebuild → bump pointer. The recurring "integrator tax."

## Co-run (the Ableton-editing UX)
Co-run is **host code** (`schwung_shim.c` + `shadow_ui.c/.js` + `shadow_constants.h`) and is now an
upstream Schwung capability. It hands Move's OLED + nav controls to Move's *native* device-edit /
preset-browser UI while the tool keeps pads/steps/transport and the sequencer keeps playing. The tool
calls `shadow_corun_begin/end` behind a capability gate. See `schwung/docs/CORUN.md` in upstream
Schwung.

## Track model (summary; full detail in HYBRID-GROOVEBOX.md)
Two resource pools: **≤4 Ableton-engine slots** (`ROUTE_MOVE`, inject cable 2 by channel) +
**unlimited hosted slots** (`ROUTE_SCHWUNG`, MIDI to Schwung slots) + external. Any UI track 1–4 can
be Ableton *or* hosted; tracks 5+ are hosted-only. One uniform `track_view` + param descriptor → one
renderer for both kinds.

The default template is intentionally simpler than the capability model: tracks
1-4 are Move-routed and tracks 5-8 are Schwung-routed. That is the first-run
experience documented in `QUICK-START.md`; it should not be implemented by
removing route flexibility from the tool.

## Unified automation
Move already has native per-step parameter automation. Overture's automation work is about making a
single deeper timeline for Move engines and Schwung/open tracks, not claiming Move lacks p-locks.
For Move-routed tracks, the measured route is **cable-0 encoder-CC injection** →
`MidiSurface` → `GetMappedParameter` → `SetManualValue` (see `ABLETON-ENGINE-ACCESS.md`). Positional
addressing means knob N controls the current device view's mapping, so it composes with co-run when
Move's native device page is the target.

## Module authoring & the open-engine side (moveforge)

`~/src/moveforge` is the **module factory** for the open-engine tracks — a dev-time authoring
harness (you own it; *not* forked/mirrored, *not* a runtime dependency). One DSP source
(Faust-first, or plain C) → both a device `dsp.so` and a browser `.wasm`, packaged with a
**standardized** `module.json` (`capabilities.ui_hierarchy` params + `knobs` mapping), a generated
`ui_chain.js` (preset-browser + knob-bank param editor), `presets.json`, golden render tests, and a
browser dev loop. That standardization — every module exposing the same `ui_hierarchy`/`knobs`/
`ui_chain` shape — **is** Overture's UX-consistency contract for the open side.

Relationship:
```
moveforge (author) ──build──▶ standardized module (.so + module.json + ui_chain.js)
                                   │ installed into Schwung
                                   ▼
Overture hosted track (ROUTE_SCHWUNG) loads it; editing rendered by Schwung's chain editor
```
- **Authoring:** keep building open sounds in moveforge as today. Overture just loads the output.
- **`overture/modules/`** = a curated set of **moveforge `dist/` output** (bundle built artifacts;
  optionally submodule moveforge only if you want Overture's build to rebuild from source).
- **No impact on the `schwung`/`tool` forks** — the tool loads modules by `module.json`, agnostic to
  how they were built.

## Editing model: delegate to native editors via co-run (don't rebuild param UIs)
The pragmatic, *more consistent* path (what dAVEBOx does) is **not** to re-render every track's params
in Overture's own UI, but to **delegate sound editing to the editors that already render
consistently**:
- **Open tracks** → **chain-edit co-run** → Schwung's chain editor renders the module's standardized
  `ui_chain` (the moveforge convention). *This is how moveforge's consistency reaches Overture.*
- **Ableton tracks** → **Move-native co-run** → Move's own device-edit / preset UI.

So Overture's *own* UI stays focused on the **sequencer**; sound/preset/param editing is delegated to
the native, already-consistent editors. (The heavier "uniform `track_view` renders all params in-tool"
described in `HYBRID-GROOVEBOX.md` remains an option for deeper unification, but delegate-via-co-run is
the lower-code, lower-fragility default — and it's *why* chain-edit co-run is worth carrying in the
`schwung` fork.)

Loading an engine follows the same rule. The user should see one route-aware
sound command; Overture delegates Move-routed engine choice to Move's native
flow and Schwung-routed module choice to the Schwung chain/module flow.

## Build / install / device
- **Build:** one `build.sh` → patched shim + shadow_ui + tool `dsp.so`/`ui.js` + bundled modules.
- **Install:** one `install.sh` → deploys all to `move-em.local` (data partition only; never touch
  `/usr/lib/...` symlinks — recreated by `schwung-heal`). Restart Move to load.
- **Boot-to-Overture** (last, optional): own the launch entrypoint so power-on lands in Overture.
  This is host-level and should happen only after the Overture UI is coherent. Rely on
  `schwung-heal`; keep `/data` backup + reflash path. Defer to the end.
