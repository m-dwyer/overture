# Overture

**Working rule:** Before acting on any assumed or suggested cause/fix, read the relevant code and verify the assumption is correct first.

## Session workflow

- **Validate before acting** — read or grep actual code first. Never act on assumptions.
- **Branching** — create a new branch for each refactor / major feature addition / major revision (`git checkout -b <descriptive-name>` off `main` before any code changes). Small, isolated fixes can land directly on main. When in doubt, branch. One commit per logical change. Merge to main with fast-forward when the work is verified and approved.
- **AGENTS.md**: update at session end or after a major phase — not after routine task work.
- **README.md**: keep the project overview and docs index current when repo-level docs move or major user-facing surfaces change.
- **Releases**: use the `release` Agent Skill. Never cut a release without an explicit SemVer version from the user and a clean `main`.
- **State version bump**: **Avoid bumping the state version** — users see a confirm dialog on mismatch and lose their session data. Prefer migrating old fields in `seq8_load_state` (default missing keys, clamp out-of-range values). Only bump when the format is genuinely incompatible (struct layout change that can't be migrated). When a bump is unavoidable during dev, wipe state files on device: `ssh root@move.local "find /data/UserData/schwung/set_state -name 'seq8-state.json' -exec rm {} \; && find /data/UserData/schwung/set_state -name 'seq8-ui-state.json' -exec rm {} \;"`.
- **DSP calls / pfx code**: read `overture-ui/docs/DAVEBOX_API.md` for parameter keys, structs, and algorithm details.
- **DSP work**: read `overture-ui/dsp/CLAUDE.md` for logging, build, state format keys, and deferred save details.
- **Schwung patches**: see `overture-ui/docs/SCHWUNG_PATCHES.md`. Fork at `legsmechanical/schwung`.
- **Capability gating**: patched-Schwung features gate on `typeof shadow_xxx === 'function'`. See `Edit Sound...` / `editSoundForTrack()` for the pattern.

## Commit workflow

- Use one logical commit per completed change.
- Use Conventional Commit subjects: `feat:`, `fix:`, `perf:`, `docs:`, `refactor:`, `test:`, `build:`, `chore:`, or `release:`.
- Prefer concise, user-meaningful subjects, e.g. `fix: prevent AUTO lane header duplication`.
- For every user-visible `feat:`, `fix:`, or `perf:`, update `overture-ui/CHANGELOG.md` under `[Unreleased]` in the matching subsection.
- When controls, displays, pad/button semantics, persistence, or workflows change, update `docs/MANUAL.md` in the same commit. Skip for internal-only changes.
- Before committing code changes, run `cd overture-ui && pnpm verify`.
- For PRs, use the `pr` Agent Skill or run `scripts/prepare_pr.sh` to generate `.pr-body.md`, then fill the judgment sections before `gh pr create`.
- For releases, choose SemVer intentionally: patch for fixes/polish, minor for new user-facing capability, major only for deliberate breaking changes after `1.0.0`.

Overture is a Schwung **tool module** (`component_type: "tool"`) for Ableton Move,
forked from dAVEBOx and extended into a cohesive groovebox surface for Move's native
engines plus Schwung modules. C (DSP) + JavaScript (UI). `button_passthrough: [79]` +
`claims_master_knob: true` — Move firmware handles CC 79 natively; `claims_master_knob`
prevents Schwung host from running its own acceleration, which caused inconsistent
knob speed and MIDI output pauses.

## Boy Scout rule — leave touched code more aligned with the target architecture

The architecture (ADR-0001 deep modules by runtime concept; `overture-ui/CONTEXT.md` ubiquitous language) is reached **incrementally, not by rewrite**. When you change or extend an `overture-ui/ui/*.mjs` module, make a small, bounded improvement in the same commit — scoped to the change's blast radius, never a drive-by rewrite of untouched modules. When you touch a module:

- **Types** — if it's not yet in `overture-ui/tsconfig.json` `include`, add it and JSDoc its `(S, deps, …)` signatures; declare the host slice it needs as a co-located `Deps` `@typedef` (pattern: `ui_recording_workflow.mjs`). If already typed, keep it green. Shared `State` lives in `overture-ui/ui/types.d.ts`; per-module `Deps` live in the module.
- **Coupling** — don't widen `S` access or add a cross-folder import `dependency-cruiser` forbids. Prefer narrowing: pull a concept's fields toward its own sub-object/typedef. Driving a `warn`-level rule's count down (then promoting it to `error`) is ideal boy-scout work.
- **Tests** — extend the module's `tests/<folder>/*.test.ts` to pin the behavior you change.
- **Language** — name things per `overture-ui/CONTEXT.md`; if you coin a load-bearing term, add it there.

**The ratchet (run before every commit):** `cd overture-ui && pnpm verify` (= `typecheck` + `depcruise` + `test`). It fails closed — a type regression, a forbidden import, or a broken test blocks you. `error`-severity dep rules hold today and must never regress; `warn`-severity rules are enumerated known debt to drive toward zero. **Never loosen a ratchet to make a change pass — fix the change.** GitHub workflows also run for PRs, but local verify is the development gate.

## Build / debug

```sh
cd overture-ui
./scripts/build.sh                         # full DSP + UI bundle
./scripts/bundle_ui.sh                     # JS-only bundle
nm -D dist/overture/dsp.so | grep GLIBC    # verify <= 2.35
ssh ableton@move.local "tail -f /data/UserData/schwung/seq8.log"
```

**JS modules** live under `overture-ui/ui/`: `ui.js` (the composition root) stays at the `ui/` root, and `ui_*.mjs` modules are grouped by runtime concept. Current top-level folders include `bank/`, `components/`, `core/`, `corun/`, `drum/`, `input/`, `lifecycle/`, `menu/`, `midi/`, `motion/`, `pad/`, `perform/`, `persist/`, `render/`, `shared/`, `sound/`, `sync/`, `tick/`, and `view/`. They bundle into `overture-ui/dist/overture/ui.js` by `overture-ui/scripts/bundle_ui.sh` (esbuild, run on the host; `build.sh` invokes it outside Docker). esbuild resolves the dep graph itself, so there is **no manual ORDER list** and adding a new `ui_*.mjs` in any folder needs no bundler edit. The script then runs a **QuickJS parse gate** (the device's exact `qjs` from `schwung/libs/quickjs`) — this catches QuickJS-fatal issues the V8 tests and `node --check` miss, because those run against source, never the bundle. **DSP**: see `overture-ui/dsp/CLAUDE.md`.

**Groovebox design system** lives under `overture-ui/ui/components/`. Reusable OLED, pad,
button, and modal primitives should be created there and consumed by feature
modules, with matching tests under `overture-ui/tests/components/`. Overture may wrap
Schwung `shared/*` utilities, but do not edit the `schwung` submodule for
Overture-specific UX unless the work is explicitly intended as an upstream
Schwung shared-widget change.

**Tests.** UI-module unit tests live in `overture-ui/tests/<concept-folder>/*.test.ts` (vitest) — they import `ui/*.mjs` via the `@overture-ui` alias (`vitest.config.ts` → `./ui`) and drive each module with mock `deps`; no WASM/emulator/DOM. Run with `pnpm -C overture-ui test` (or `mise run utest`). These were relocated out of `web/tests/integration/` (2026-06-17) — `web/` now owns only the real seq8-WASM + emulator integration tests (`mise run itest`). A few `ui/*.mjs` import schwung `shared/*` by absolute on-device path; `vitest.config.ts` remaps those to the schwung dev checkout (`SCHWUNG_SRC` overrides). All tests run under vitest (the old `node:test` tick test was folded in); source-order assertions `readFile` the module under `ui/` by relative path.

## State persistence

DSP state v=36. On version mismatch (v>0 && v≠36), a confirm dialog asks the user before erasing; "No" exits module with the file preserved. **Backward compatibility matters** — prefer migrating old fields over bumping the version. Full key list in `overture-ui/dsp/CLAUDE.md`.

JS `init()` reads UUID, compares with `state_uuid` get_param. Mismatch → `state_load=UUID` next tick → `pendingDspSync=5` → `syncClipsFromDsp()` → `restoreUiSidecar(true)`. Same path fires on resume when set changed while suspended (UUID mismatch on resume edge). `restoreUiSidecar(applyDefaultsNow)` — shared helper called from init() and pendingDspSync=0 completion; applies activeTrack/trackActiveClip/sessionView/activeDrumLane/perf/beatMarkers; handles no-sidecar first-run defaults.

UI sidecar (`seq8-ui-state.json`): v=8 (carries per-track active bank `tab`, per-track octave `to`, Euclid memory `dleu`, drum vel-zone arm); written on suspend/Quit/Shift+Back; wiped on Clear Session. (The old `ss` Schwung-slot key is obsolete — Schwung co-run now auto-opens the slot whose receive channel matches the track via `schSlotsForTrack`; old sidecars' `ss` is ignored, not written.) Deferred save: handlers set `inst->state_dirty = 1`; JS `pollDSP()` writes via `host_write_file` when dirty. Suspend: sidecar written immediately, `set_param('save')` deferred to end of tick() via `S.pendingSuspendSave`.

Set-duplicate inheritance: when init detects a Copy-suffixed name + missing state file, `maybeShowInheritPicker` looks up family candidates in `seq8_name_index.json` and either auto-inherits (1 candidate), opens the dialog (2+), or starts blank (0). DSP-side `prune_orphan_states` handler cleans up `seq8-*.json` files for deleted Move sets on every launch.

## Critical constraints

- **Coalescing**: only the LAST `set_param` per audio buffer reaches DSP. `shadow_send_midi_to_dsp` shares the same delivery channel and also coalesces. In `onMidiMessage`, if both fire, the set_param is lost. Defer set_params to tick() via a pending variable (see `pendingRepeatLane` pattern). Multi-field operations require a single atomic DSP command.
- **get_param from onMidiMessage**: silently returns null. Only works from tick/render callbacks. Sync JS state from DSP in tick/render path instead.
- **No MIDI panic before state_load** — floods MIDI buffer, drops the load param.
- **Shift+Back does not reload JS** — `init()` re-runs in same runtime. Full reboot required for JS changes.
- **`reapplyPalette` resets CC LED hardware states**: `input_filter.mjs` `buttonCache` holds stale color → subsequent `setButtonLED` calls silently dropped. Call `setButtonLED(cc, color, true)` (force=true) after every `reapplyPalette` for persistent button LEDs.
- **Palette SysEx rate-limit**: gate updates to `POLL_INTERVAL` cadence + `ccPaletteCache` to skip SysEx when unchanged. Rapid knob turns otherwise fill the MIDI queue.
- **Multi-step toggle coalescing**: 3–4 simultaneous step presses → only the last set_param survives. Fix if observed: `pendingMultiToggle` array drained in tick().
- **Schwung host silently drops new module-defined global `set_param` keys.** Existing keys grandfathered into the codebase (`bpm`, `key`, `transport`, `mute_all_clear`, etc.) work fine, but adding a *new* global key from JS results in `host_module_set_param` returning silently while the DSP handler never fires. Per-track-prefixed keys (`tN_*`) reliably reach DSP. Workaround: piggyback new globals onto an existing per-track push (e.g. `tN_padmap` sets `active_track` and `dsp_inbound_enabled` from `tidx`). Verify a new global is reaching DSP with a one-line `seq8_ilog` at the top of `set_param` before building on it. `host_module_set_param('debug_log', msg)` is *also* unreliable in practice — same failure mode. (Discovered 2026-05-16 during Phase 1 Bundle 1.)
- **ROUTE_MOVE external MIDI bypasses pfx chain**: injecting causes echo cascade (Move echoes cable-2 back → re-injection → crash). Use ROUTE_SCHWUNG if pfx processing on live external MIDI is needed.
- **pfx_send from set_param context does NOT release Move synth voices.**
- **`get_clock_status` is NULL**; `get_bpm` doesn't track BPM changes while stopped.
- **Do not load dAVEBOx from within dAVEBOx** — LED corruption. Shift+Back first.

## Pad drop diagnostic

Intermittent: drum pads go silent while sequencer plays. Self-heal in `tick()` re-pushes padmap on mismatch. When investigating pad silence on hardware, check `seq8-pad-drop.log` and report non-empty diagnostics to the user.

## QuickJS compatibility

shadow_ui runs QuickJS, not V8. Node.js `--check` is NOT a reliable validator.
- **Member expressions as object keys are a syntax error**: `{ S.shiftHeld: val }` → use plain identifiers `{ shiftHeld: val }`. Caused a multi-hour debug session.
- **Confirmed supported**: `??`, `...` spread/rest, `for...of`, `Array.from`, `globalThis`, `Set`, `Map`.

## JS internals

- `overture-ui/ui/ui.js` is the UI Runtime composition root. Keep public Schwung entrypoints
  (`globalThis.init`, `globalThis.tick`, `globalThis.onMidiMessageInternal`,
  `globalThis.onMidiMessageExternal`) assigned there. Extract by runtime concept
  and invariant, not by file size; see `overture-ui/docs/adr/0001-refactor-by-runtime-concept.md`.
- Entrypoint exceptions are intentionally swallowed by
  `ui_entrypoint_diagnostics.mjs` after deduped logging to
  `/data/UserData/schwung/seq8-jserr.log`. Preserve the log path, dedupe key
  `(where|message)`, context fields, and stock-host no-op behavior.
- Tick Pipeline ordering is load-bearing. In `runTickWorkflow`, pad-map
  recompute stays before the default set-param drain; `pendingSetLoad` drains
  before `pendingDefaultSetParams`; DSP mirror resync runs after those drains;
  `pendingSuspendSave` is an end-of-tick persistence action; final draw is gated
  by suspend state. Extend the source-order/focused tests before moving any of
  those calls.
- **Two-tick deferred pattern** (`_toggle` / `_set_notes`): activate step on tick N, write notes on tick N+1. Phase-2 check must precede phase-1 in tick().
- `pendingDrumResync` deferred 2 ticks after drum clip switch; `pendingStepsReread` 2 ticks after `_reassign`/`_copy_to`.
- `bankParams[t][b][k]`: 7 banks, refreshed via `tN_cC_pfx_snapshot`. Track config uses dedicated arrays + `readTrackConfig`/`applyTrackConfig` — NOT in bankParams.
- `pendingDefaultSetParams`: first-run defaults drain one per tick after state settles.
- **JS tick rate**: ~94 Hz on device. `STEP_HOLD_TICKS=19` calibrated for ~94 Hz. Older constants use 196 Hz assumptions.
