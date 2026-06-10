# Overture — Roadmap

**Emulator-first.** The augment base is already proven (dAVEBOx ships it), so the project's value
and risk live in the **UX** — which iterates fastest in a browser emulator, not on device. So we
front-load the emulator + UX, fork dAVEBOx early as the substrate, and reserve the device for the few
things only it can validate. Authoritative phase plan (supersedes the phasing in `HYBRID-GROOVEBOX.md`).

---

## Status & current focus (updated 2026-06-10) — READ FIRST

**Done:** P1 (fork builds + runs on `move-em.local`), P2 (emulator runs the real UI + `seq8`-wasm).
**P3 in progress.** Shipped + device-verified (live status in `DAVEBOX-CHANGES.md`): **#1** side-buttons→
track-select + hold-reveal clips + track-identity LEDs · the **OLED bank-position strip** · **#3 Phase A**
(hold-step + jog = step length, + a jog-cycles-banks bug fix). **Co-run is DONE** — Edit Synth/Slot works
on device (was P3's "co-run zoom"; see memory `corun-on-v0917`). #2 ~already done (React shell). Deferred:
**#3B** velocity, **#5**, **#6**.

### ⚠ Strategic reframe — supersedes the "p-lock = the novel cherry" premise below
Verified against the Move manual: **Move ALREADY has native per-step parameter automation (p-locks)** —
§14.2.4, hold-step + encoder in its Device View. So the **motion lane is NOT a capability Move lacks** —
it's *demoted* from "the differentiator." And **co-run now closes the sound-design seam.** The honest
wedge is **depth + UNIFICATION**: Overture's 8 tracks / per-step trig-conditions / polyrhythmic automation
/ bake-to-Live, sequencing **Move's 4 engines AND N open Schwung tracks in one timeline** — the open-tracks
story we've barely exercised. (Three-bucket model: Overture is (1) deeper than Move [keep], (2) missing a
few Move conveniences [#4 per-track vol], (3) different controls [the reconcile — mostly done].) See memory
`davebox-prior-art` (corrected) + `move-live-engine-seams`.

### Next up — re-prioritised (start here)
1. ✅ **DONE (2026-06-10) — the wedge experiment / inject spike.** Verdict: **#4 per-track volume has no
   clean route** (CC7 flat §4.1.3; CC79 = master encoder, bleeds to master; D-Bus has no set method).
   Detail: `WEDGE-EXPERIMENT.md`, `INJECT-PROBE.md`, memory `move-live-engine-seams`. Probe is now pure-JS
   (`overture/tool/tools/inject-probe`).
2. **Exercise the open-tracks story** — sequence ≥1 Schwung-routed (open-engine) track alongside Move's 4
   in one Overture timeline. The genuine unification differentiator. *(In progress — validation findings in
   "Backlog — fidelity findings" below.)*
3. ✅ **DONE (2026-06-10) — Note-length default quick win.** New melodic/keys steps now default to a
   full-step gate; new drum-lane steps keep the tighter half-step gate. Existing clips keep stored gates.
   Covered by real `seq8`-wasm integration tests.
4. **Phase 3 / param discoverability — now a top priority** (see Phase 3). "Hunting down params" is the core
   legibility problem and the flagship UX work.
5. **#3B** velocity (Shift+jog) — cheap warm-up if you want momentum.
6. **#5 / #6** reconcile polish — lowest value now; don't lead with these.

Housekeeping: merged branches (change-1-track-nav, oled-bank-strip, change-3-perstep, corun-tooling-and-docs)
are safe to delete.

---

## Phase 0 — Device spike (cheap, parallel; NOT a gate)
Validate the device-only things the emulator can't — using the existing `engine-probe` harness:
1. **By-channel routing to 4 Move tracks** (dAVEBOx implies yes; confirm).
2. **The p-lock lane is real** — inject cable-0 encoder CC to move a Move device param *in time*
   while sequencing (compose with co-run for device-page targeting). Our one genuinely novel risk.
3. Latency parity, note-off/hung-note safety, state read (`Song.abl` + `saveSongIfDirty`).
> Not a project gate: p-lock is the *cherry*; the cake (notes + velocity + poly-AT + open tracks +
> sequencer) is proven. But validate p-lock before building a whole UX around it. Detail:
> `HYBRID-GROOVEBOX.md` "Phase 0".

## Phase 1 — Fork dAVEBOx + get it building (the substrate)
- Private-mirror `legsmechanical/schwung-davebox` → `m-dwyer/schwung-davebox` (the `tool`).
- Build the **device** target (`dsp.so`) and confirm it runs on your stock Schwung (`move-em.local`).
- Stand up a **wasm** build of `seq8.c` (emscripten — new target; shim its host deps) for the
  behavior-tier emulator later.
- **Done when:** the 8-track sequencer runs on device, and `seq8` compiles to wasm locally.

## Phase 2 — Overture emulator (`overture/web/`)
Build the UX-iteration harness by **reusing moveforge's emulator bones** (hardware shell, OLED canvas,
wasm-DSP loader, input engine) — *not* by absorbing moveforge. See `EMULATOR.md`.
- Host-API shims (display→canvas, LED→grid, `get/set_param`, MIDI, lifecycle); Move hardware shell;
  ~94 Hz tick loop.
- **Fidelity ladder:** start **layout-tier** (real UI JS + JS-mock DSP), add **behavior-tier** (real
  `seq8`-wasm) once layout settles.
- **Done when:** the real tool UI renders + responds in the browser, fast iteration with no device.

## Phase 3 — UX design + iteration (the bulk)
Design Overture's surface in the emulator (see `UX.md`): mode/navigation model, the **motion lane**
(flagship), the **co-run "zoom into sound"** gesture, track navigation, the **color/feedback language**.
Edit *down* for immediacy/legibility — don't pile onto dAVEBOx's depth.
- **First concrete target (raised by #2 validation): param discoverability.** Per-step/per-track params are
  scattered across modal contexts (hold-step Step Edit, the 7 Global-Menu banks, Track Config, automation
  lanes) with positional, unlabeled encoders — you must already know the gesture+bank before you can see a
  param. Candidate experiments: param search, persistent labels, fewer modes.
- **Done when:** the instrument's surface feels like *Overture*, validated in-emulator.

## Phase 4 — p-lock lane (on device)
> ⚠ **Re-evaluate before building** — see the Status reframe up top: Move already has native per-step
> automation, so this is no longer a unique-capability differentiator. Gate it on the inject spike +
> the wedge question (is engine-param sequencing from Overture worth more than Move's own + co-run?).

Implement the `ROUTE_MOVE` device-param **motion/automation lane** (cable-0 encoder CC, delta,
composed with co-run targeting), designed in P3, made real here.
- **Done when:** a Move engine param automates per-step from a clip lane while the pattern plays.

## Phase 5 — Finalize UX on device + rebrand to Overture
Bring the emulator-designed UX to hardware; reconcile device-only feel (timing, LEDs, co-run); rename.
- **Done when:** it's *your* instrument on real hardware, not a dAVEBOx reskin.

## Phase 6 — Bundle into the single-install product
Stand up the monorepo glue: `schwung` (thin fork + co-run), `tool`, `modules` (curated moveforge
output), one `build.sh` + `install.sh`. Co-run pre-patched at build; user installs *one* thing.
- **Done when:** `git clone --recursive && ./install.sh` deploys the whole stack; user never sees "Schwung."

## Phase 7 — Boot-to-Overture (last, optional)
Own the launch entrypoint so power-on lands in Overture (after the engine is up). **Brick risk** —
`schwung-heal` + `/data` backup + reflash path. Only when everything else is solid.

---

## Repo / fork setup (when starting P1 / P6)
- `overture/` = private integrator monorepo (`m-dwyer/overture`) — exists.
- Submodules are **private mirrors**, not GitHub forks (can't privately fork a public repo):
  `gh repo create m-dwyer/<name> --private`, push upstream in, add `upstream` remote.
- `schwung` thin + upstream-tracked; `tool` thick + owned. **moveforge stays independent** (not a
  submodule of the runtime; its emulator bones are reused into `overture/web/`). See `ARCHITECTURE.md`.

## Maintenance strategy (the integrator tax)
- Keep `schwung` changes **minimal + capability-gated**; rebase onto releases deliberately. **Upstream
  co-run** → the fork shrinks toward stock.
- Diverge freely in `tool`. Pull dAVEBOx improvements early; stop tracking once fully diverged.

## Open decisions
- p-lock view-targeting: co-run vs self-puppeteer (P0 decides).
- How much dAVEBOx UX to keep vs replace (reshape > greenfield; decided in emulator, P3).
- Emulator fidelity: how far to push behavior-tier (real `seq8`-wasm) vs mock.
- Default module set to bundle (lean; rest via Schwung store).
- Whether to upstream the p-lock capability to dAVEBOx/Schwung (collaboration vs own product).

---

## Backlog — fidelity findings (from #2 open-tracks validation, 2026-06-10, device-confirmed)
- ✅ **Fixed (2026-06-10) — Note-length default.** Move stamps new steps at **1.0 / full step** (device-confirmed on a
  fresh set, every track); Overture/davebox stamps **0.5** (`GATE_TICKS 12 / TICKS_PER_STEP 24` in
  `dsp/seq8.c`; `stepEditGate: 12` in `ui/ui_state.mjs`) → sustained/pad/keys presets sound clipped vs native
  Move. Overture *replaces Move's sequencing but plays Move's sounds*, which are voiced for full-step, so the
  default should be **sound-correct, not a 50% groovebox default**. Implemented as **Keys 1.0 / Drum 0.5**,
  mode-aware, for newly placed steps only. Existing patterns keep their stored gate.
- **Track Mode must match the Move instrument (minor).** A davebox **Drum**-mode track on a *melodic* Move
  preset (e.g. Choir Pad) plays fixed lane notes instead of the scale layout → sounds wrong. No code bug; a
  setup/feedback gap (consider a warning, or a smarter default when Route=Move + preset category is known).
- **Param discoverability** — promoted into **Phase 3** as its first concrete target (see above).
