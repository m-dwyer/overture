# Coverage Gap Map — headless test coverage

**This is a living artifact.** The numbers below are a snapshot; regenerate the
table any time with **`mise run gap-map`** (reads both vitest v8 reports — run
`mise run cover` first). Don't hand-edit the per-module numbers; they rot.

Two tiers measure different things; a module is only truly untested when **both**
are low:
- **Unit%** — `overture-ui/tests/**` drive `ui/*.mjs` with **mock `deps`** (logic, no engine).
- **Behavior%** — `web/tests/integration/**` run the **real `ui.js` + seq8-wasm** (engine path).
- **Union%** — covered by *either* tier (the honest "tested anywhere headless" number).

See [`HEADLESS-COVERAGE-PLAN.md`](HEADLESS-COVERAGE-PLAN.md) for the strategy and
[`HARNESS-EVOLUTION.md`](HARNESS-EVOLUTION.md) for where the harness goes next
(fidelity ceiling, real-Schwung-host tier, manual generation).

---

## Snapshot — 2026-06-18

**Unit 77.4% · Behavior 63.4% · Union 89.9%** (statements). Since the Step-1
baseline (behavior 57.3%), Step 2 took the persistence area and Step 3–4 the
AUTO/CC p-lock *edit* path through the real engine.

### Now well-covered (behavior tier)
- `persist/ui_persistence.mjs` 95% · `sync/ui_clip_state_sync.mjs` 89% ·
  `persist/ui_snapshot_workflow.mjs` 72% · `persist/ui_inherit_picker_workflow.mjs` 70%
  — sidecar suspend→resume, set-duplicate inherit, clear/snapshot/export-entry.
- `view/ui_track_view_step_workflow.mjs` 47% — sequenced per-step CC p-locks.

### Still load-bearing and thin (the real backlog)
| Area | Module(s) | Behavior% | Note |
|---|---|---|---|
| AUTO/CC p-lock **output** | `input/ui_knob_cc_workflow.mjs` | 19% | edit/store done; **playback emission untested** (and partly device-only). |
| Export packager | `persist/ui_export.mjs` | 25% | request/confirm only; `pollPendingExport` needs `host_system_cmd`. |
| Tick pipeline | `tick/ui_tick_tasks.mjs` | 60% | deferred-queue drains / two-tick patterns — the riskiest *headless-able* seam. |
| Drum lanes / repeat | `drum/ui_drum_lane_workflows.mjs` (11%), `*_repeat_workflows` | 11–21% | solid under mocks, thin through the engine. |
| Perform | `perform/*` (mute/solo, transpose, tap, recording) | <30% | same — unit-proven, engine-unproven. |

> Run `mise run gap-map` for the full per-module table.

---

## Honest caveats (what a green number does *not* mean)

- **Coalescing is invisible.** The harness has no audio buffer, so it never
  reproduces the device rule "only the last `set_param` per buffer reaches DSP."
  A test can pass while the device drops the write. This is the #1 fidelity gap.
- **The engine state roundtrip is partly faked.** The wasm DSP keeps state
  in-memory and never writes `seq8-state.json`; the snapshot test *seeds* the
  file, so it proves the JS orchestration, not the real save→file→load path.
- **V8 ≠ QuickJS, Node ≠ device.** Runtime divergence, RT timing, 94 Hz tick,
  real audio/LED/OLED are all out of reach here — see
  [`DEVICE-SMOKE.md`](DEVICE-SMOKE.md) for the device-only complement.

These ceilings — not the remaining % — are the real limit, and the subject of
[`HARNESS-EVOLUTION.md`](HARNESS-EVOLUTION.md).
</content>
