# Headless Coverage Plan — verify Overture without the Move

**Goal:** maximize what we can verify **headlessly** (host-side, no device) so we
rarely need to deploy to the physical Ableton Move. Device trips should become
**rare and targeted**, not "deploy to check everything."

**Hard rule for the work:** do *not* deploy or build the device `dsp.so`; work
entirely host-side. Plan first, then execute in small verified steps.

---

## Current state (grounded, 2026-06-17)

Two vitest tiers exist:

1. **Unit tier** — `overture-ui/tests/<concept>/*.test.ts`
   - `ui/*.mjs` driven by **mock `deps`**; no WASM/emulator/DOM.
   - 62 files / **1081 tests**. Run: `pnpm -C overture-ui test` (`mise run utest`).
   - Alias `@overture-ui` → `overture-ui/ui` (in `overture-ui/vitest.config.ts`).

2. **Behavior tier** — `web/tests/integration/` via `harness.ts`
   - The **REAL `ui.js` + REAL `seq8`-wasm** engine, recorder sinks
     (prints / LEDs / button-LEDs / MIDI-out / `get_param` engine truth).
   - Only **5 files / 97 tests** today (`behaviour`, `sequencer`, `state-roundtrip`,
     `tool`, `session-view-workflow`) — the engine is reachable but barely used.
   - Run: `pnpm -C web test:node` (`mise run itest`). wasm prebuilt at
     `overture-ui/dist/wasm/seq8.{mjs,wasm}` (`mise run wasm` to rebuild).

**Key findings that shape the plan:**
- **No code-coverage is configured anywhere** — clean slate. Measure before improving.
- The behavior/harness tier is the **"avoid the Move" engine** and is under-used.
- The DSP C (`overture-ui/dsp/seq8.c` `#include`s `seq8_set_param.c`, one translation
  unit, ~5k+3k lines) is exercised **only indirectly via wasm**. Build targets are
  aarch64-Docker (`build.sh`) + emscripten wasm (`build-wasm.sh`) — **no native/x86
  gcov host build** exists.

## What genuinely CANNOT be taken off the Move (irreducible smoke list)

These are device-only by nature — don't try to fake them; cover them with a short
checklist instead:
- **Schwung host integration**: co-run APIs, `host_module_set_param` coalescing /
  silent-drop of new global keys, set_param delivery timing.
- **QuickJS-vs-V8 divergence**: vitest runs V8; the bundle's QuickJS **parse** gate
  catches syntax, not runtime behavior.
- **Real audio**: the metronome click actually sounding (the exact class of bug we
  just fixed — a wrong on-device path compiled fine and passed all headless tests),
  `pfx_send` voice release, ROUTE_MOVE echo cascade.
- **Hardware**: OLED/LED rendering, palette SysEx, real pad/encoder MIDI, 94 Hz tick
  rate, RT scheduling.

---

## Plan (do in order; get sign-off between steps)

### Step 1 — Measure (easy, hours)
Add **vitest v8 coverage** to BOTH tiers (`@vitest/coverage-v8`, `--coverage`,
`coverage` config in both `vitest.config.ts`; add `test:coverage` scripts + a
`mise run cover` task). Produce a **gap map**: which `ui/*.mjs` and which behaviors
are uncovered. Don't pad numbers — surface the load-bearing untested paths:
- Tick Pipeline ordering / deferred-queue drains
- `set_param` coalescing & the two-tick deferred patterns
- Persistence roundtrip (state v=36 save/load, UI sidecar)
- Drum lanes / drum repeat / Pad Surface
- Move Co-Run enter/exit + reconcile
- AUTO/CC p-locks (cable-0 encoder-CC), the novel path

### Step 2 — Grow the behavior tier (medium, highest value)
Plan + build out `web/tests/integration/` (real `ui.js` + wasm) to cover the
end-to-end flows currently only provable on-device. Target the gap map from Step 1.
Decide **with the user** whether to also add a **native x86 gcov build** of the DSP
(single TU → tractable) + a small C harness on the plugin API for C-level line
coverage, vs. relying on wasm-via-harness for behavioral DSP coverage. Present the
options before building.

### Step 3 — Device smoke checklist (small, durable)
Write/maintain `docs/DEVICE-SMOKE.md`: the short, ordered list of *only* the
irreducible-gap items above, with the exact gesture + expected result for each, so a
device trip is a 5-minute targeted pass, not a full re-test.

---

## Gates & workflow
- Gates: `mise run utest`, `mise run itest`, `overture-ui/scripts/bundle_ui.sh`
  (esbuild + QuickJS parse gate). Add `mise run cover` in Step 1.
- Two repos: commit **overture-ui** (submodule) first, then the **overture** parent
  (+ submodule pointer bump). Refactor/infra commits skip the overture-ui CHANGELOG;
  a user-visible `fix:`/`feat:` gets a `[Unreleased]` entry.
- Footer: `Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>`.
- Use the `improve-codebase-architecture` mindset: where a module is hard to test
  through its current interface, that's a seam worth deepening — but don't add shallow
  pass-throughs just to hit a coverage number.

## Kickoff line for the new context
> Read `docs/HEADLESS-COVERAGE-PLAN.md` and do Step 1 (wire up vitest coverage on both
> tiers and produce the gap map). Don't deploy to the Move.
