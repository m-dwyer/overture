# Coverage Gap Map — Step 1 output

Produced by Step 1 of [`HEADLESS-COVERAGE-PLAN.md`](HEADLESS-COVERAGE-PLAN.md):
vitest v8 coverage is now wired into **both** headless tiers. This is the
measure-before-improving baseline that Step 2 (grow the behavior tier) targets.

**Reproduce:** `mise run cover` (runs both tiers; writes
`overture-ui/coverage/` and `web/coverage/`, each with an HTML report at
`coverage/index.html`). Per-tier: `pnpm -C overture-ui test:coverage`,
`pnpm -C web test:coverage`.

**Snapshot:** 2026-06-17 — unit 1081 tests / 62 files, behavior 97 tests / 5 files.

---

## How to read this

Two tiers measure different things, so a module is only truly "untested" when
**both** are low:

- **UNIT%** — `overture-ui/tests/**` drive the decomposed `ui/*.mjs` factory
  modules with **mock `deps`**. High unit% = the module's branching logic is
  exercised, but against a fake host. `ui/ui.js` (the composition root) is
  *excluded* here — it's measured in the behavior tier. `all:true`, so a module
  with no unit test shows as 0% rather than vanishing.
- **BEHAVIOR%** — `web/tests/integration/**` run the **real `ui.js` + real
  seq8-wasm** through the emulator. High behavior% = the real engine path
  actually executes that code on device-equivalent plumbing. `all:false` — only
  what the harness loads is counted (no synthetic 0% rows).
- **UNION%** — a statement covered by *either* tier (computed from both
  `coverage-final.json`, which key on the same absolute paths). This is the
  honest "is it tested at all, anywhere headless" number.

### Aggregate (statements)

| Tier | Covered | Total | % |
|---|---|---|---|
| Unit (mock deps) | 11703 | 15122 | **77.4%** |
| Behavior (real engine) | 9854 | 17189 | **57.3%** |
| **Union** | 15053 | 17197 | **87.5%** |

(Behavior/union denominators include `ui.js`'s 2075 statements, which unit excludes.)

---

## Tier A — load-bearing paths untested in *either* tier (low UNION%)

These are the real holes. Fix order is roughly top-down (gap × size).

| Module | UNIT% | BEHAVIOR% | UNION% | Stmts | Note |
|---|---|---|---|---|---|
| `persist/ui_export.mjs` | 20.1 | 21.5 | **21.5** | 502 | **Biggest hole.** Set export/serialization barely touched by anything. |
| `menu/ui_dialogs.mjs` | 0.0 | 29.2 | **29.2** | 209 | No unit test at all; only incidental behavior coverage. |
| `persist/ui_persistence.mjs` | 22.6 | 30.9 | **30.9** | 327 | **Persistence roundtrip** (plan priority) — state save/load + sidecar mostly unproven headless. |
| `input/ui_knob_cc_workflow.mjs` | 50.8 | 7.1 | **50.8** | 836 | **AUTO/CC p-locks live here** (cable-0 encoder-CC, the novel path). Huge file, half-tested even in unit; almost untouched by the real engine. |
| `render/ui_leds.mjs` | 2.8 | 79.1 | **79.1** | 864 | LED rendering — only the real-engine path exercises it; no unit coverage. (Pixel/LED truth is partly device-only — see plan's irreducible list.) |

`ui.js` itself: **83.0%** (2075 stmts, behavior-only). The remaining ~350
uncovered statements in the composition root are the next-largest single target.

---

## Tier B — behavior-tier gaps (high UNIT%, low BEHAVIOR%)

These are **proven only with mock `deps`, never through the real `ui.js` +
seq8-wasm engine path** — exactly the class of bug the plan calls out (a wrong
on-device path that compiles + passes all mock tests). This is the primary
backlog for Step 2.

| Module | UNIT% | BEHAVIOR% | Concept (plan priority) |
|---|---|---|---|
| `drum/ui_drum_lane_workflows.mjs` | 100 | **11.2** | Drum lanes |
| `drum/ui_drum_repeat_workflows.mjs` | 98.1 | **21.0** | Drum repeat |
| `pad/ui_pad_surface.mjs` | 98.0 | **53.1** | Pad Surface |
| `perform/ui_tap_tempo_workflow.mjs` | 100 | **7.3** | — |
| `perform/ui_mute_solo_workflow.mjs` | 100 | **11.4** | — |
| `perform/ui_transpose_workflow.mjs` | 100 | **12.1** | — |
| `perform/ui_recording_workflow.mjs` | 100 | **25.8** | — |
| `menu/ui_clear_auto_workflow.mjs` | 100 | **8.7** | AUTO/CC p-locks (clear) |
| `input/ui_transport_cc_workflow.mjs` | 94.8 | **16.1** | Transport |
| `input/ui_navigation_cc_workflow.mjs` | 96.6 | **17.7** | Navigation |
| `midi/ui_midi_external_workflow.mjs` | 97.6 | **1.2** | External MIDI / ROUTE_MOVE |
| `pad/ui_pad_aftertouch_workflow.mjs` | 100 | **2.9** | Poly-AT (a measured live seam) |
| `view/ui_track_view_step_workflow.mjs` | 99.7 | **40.2** | Step editing |
| `tick/ui_tick_tasks.mjs` | 98.4 | **53.2** | **Tick Pipeline** drains / two-tick deferred |
| `sync/ui_polldsp_workflow.mjs` | 95.4 | **64.8** | `set_param` coalescing / deferred saves |
| `render/ui_session_overview_render.mjs` | 100 | **5.7** | Session overview render |
| `persist/ui_snapshot_workflow.mjs` | 100 | **7.2** | Snapshot persistence |

---

## Plan priority concepts → current coverage

Mapping the plan's named load-bearing paths to where they live:

- **Tick Pipeline ordering / deferred-queue drains** — `tick/ui_tick_tasks.mjs`
  (unit 98 / behavior 53), `tick/ui_tick_workflow.mjs` (unit 70 / behavior 100).
  Ordering invariants are exercised by the real engine but `tick_tasks` internals
  largely are not.
- **`set_param` coalescing & two-tick deferred patterns** —
  `sync/ui_polldsp_workflow.mjs` (behavior 65), `tick/ui_tick_tasks.mjs`. The
  coalescing/deferred drains are the riskiest device-only seam; behavior coverage
  is the only headless proof and it's partial.
- **Persistence roundtrip (state v=36 save/load, UI sidecar)** —
  `persist/ui_persistence.mjs` (union **31%**), `persist/ui_export.mjs` (union
  **22%**), `persist/ui_snapshot_workflow.mjs` (behavior 7%). **Weakest priority
  area overall.** (Note: one `state-roundtrip` behavior test exists but covers
  little of these modules.)
- **Drum lanes / drum repeat / Pad Surface** — `drum/ui_drum_lane_workflows.mjs`
  (behavior 11), `drum/ui_drum_repeat_workflows.mjs` (behavior 21),
  `pad/ui_pad_surface.mjs` (behavior 53). Unit-solid, real-engine-thin.
- **Move Co-Run enter/exit + reconcile** — `corun/ui_corun_workflow.mjs`
  (union **100%**, behavior 98). **Already well covered** in both tiers — the
  exception, not the gap. (Cross-check device reconcile against
  [`MOVE-RECONCILE.md`](MOVE-RECONCILE.md).)
- **AUTO/CC p-locks (cable-0 encoder-CC)** — `input/ui_knob_cc_workflow.mjs`
  (union **51%**, behavior **7%**), `menu/ui_clear_auto_workflow.mjs` (behavior
  9%). The novel product path, and one of the least-covered. High-value Step 2
  target.

---

## Notes / caveats

- Union assumes the two tiers' per-file statement maps align (they do — both
  transform the same source via vite). Treat union% as a close approximation, not
  a merged-istanbul report.
- **Don't chase the number.** Per the plan, several low-behavior modules
  (`ui_leds`, pad/LED render) are partly **device-only** (OLED/LED truth, palette
  SysEx, 94 Hz tick) and belong on the Step 3 device-smoke checklist, not the
  headless backlog.
- The behavior tier currently has only **5 test files** — its low totals reflect
  *test breadth*, not unreachable code. The engine is reachable; Step 2 is about
  writing the flows.
</content>
