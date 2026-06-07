# Overture — Roadmap

**Emulator-first.** The augment base is already proven (dAVEBOx ships it), so the project's value
and risk live in the **UX** — which iterates fastest in a browser emulator, not on device. So we
front-load the emulator + UX, fork dAVEBOx early as the substrate, and reserve the device for the few
things only it can validate. Authoritative phase plan (supersedes the phasing in `HYBRID-GROOVEBOX.md`).

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
- **Done when:** the instrument's surface feels like *Overture*, validated in-emulator.

## Phase 4 — p-lock lane (on device)
Implement the `ROUTE_MOVE` device-param **motion/automation lane** (cable-0 encoder CC, delta,
composed with co-run targeting) — the novel capability, designed in P3, made real here.
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
