# Overture — Roadmap

Build order is deliberately **tool-first, packaging-last** — get the instrument great on the
Schwung you already have, then wrap it into the single-install product. Don't build the installer
around a tool that doesn't exist yet.

## Phase 0 — Validate the make-or-break unknowns (cheap, before UI work)
Most are answered by dAVEBOx already; confirm on *your* device. Full list in
`HYBRID-GROOVEBOX.md` "Phase 0". The ones that could reshape the plan:
1. **By-channel routing to 4 Move tracks** — dAVEBOx's `ROUTE_MOVE` says *yes*; confirm.
2. **Latency parity** — injected-Ableton vs local-hosted on the same step align (Schwung Latency Comp).
3. **The p-lock lane under co-run** — can you inject cable-0 encoder CC to automate a Move device
   param *in time* while sequencing, with co-run handling the device-page targeting? (Our one truly
   novel unknown — scope the timing/rate.)
4. Note-off/hung-note safety, state read (`Song.abl` + `saveSongIfDirty`), knob→param map.

## Phase 1 — Fork dAVEBOx, run it on stock Schwung
- Private-mirror `legsmechanical/schwung-davebox` → `m-dwyer/schwung-davebox` (the `tool`).
- Build + deploy to `move-em.local`; confirm the 8-track sequencer runs (co-run gated off on stock
  Schwung). Reconcile the deploy target (dAVEBOx targets `move.local`).
- **Done when:** a working 4-Ableton + 4-Schwung groovebox runs on your device.

## Phase 2 — Build the p-lock lane (the novel capability)
- Add a `ROUTE_MOVE` **device-param automation lane**: per-clip encoder-CC (cable 0, delta) targets,
  composed with co-run's device-page targeting.
- **Done when:** a Move engine parameter (e.g. filter) automates per-step from a clip lane while the
  pattern plays.

## Phase 3 — Reshape the UX (incrementally) into Overture
- Evolve the tool's UI toward your vision (the layer you own); rename/rebrand to Overture.
- **Done when:** it feels like *your* instrument, not a dAVEBOx reskin.

## Phase 4 — Bundle into the single-install product
- Stand up the `overture/` monorepo: `schwung` (thin fork + co-run), `tool` (your fork), `modules`
  (curated defaults), one `build.sh` + `install.sh`.
- Co-run pre-patched at build; user installs *one* thing.
- **Done when:** `git clone --recursive && ./install.sh` deploys the whole stack; user never sees
  "Schwung."

## Phase 5 — Boot-to-Overture (last, optional)
- Own the launch entrypoint so power-on lands in Overture (after the engine is up).
- **Brick risk** — `schwung-heal` + `/data` backup + reflash path. Only when everything else is solid.

## Repo / fork setup (when starting Phase 1/4)
- `overture/` = private integrator monorepo (`m-dwyer/overture`).
- Submodules are **private mirrors**, not GitHub forks (can't privately fork a public repo):
  `gh repo create m-dwyer/<name> --private`, push upstream in, add `upstream` remote.
- `schwung` thin + upstream-tracked; `tool` thick + owned. See `ARCHITECTURE.md`.

## Maintenance strategy (the integrator tax)
- Keep `schwung` changes **minimal + capability-gated**; rebase onto Schwung releases deliberately
  (not continuously). **Upstream co-run** → the fork shrinks toward stock.
- Diverge freely in `tool`. Pull dAVEBOx improvements early; stop tracking once you've fully diverged.

## Open decisions
- Where exactly the p-lock-lane view-targeting lives (co-run vs self-puppeteer) — Phase 0 Q3 decides.
- How much of dAVEBOx's UX to keep vs replace (depends on your UX vision; reshape > greenfield).
- Default module set to bundle (lean; rest via Schwung store).
- Whether to upstream the p-lock capability to dAVEBOx/Schwung (collaboration vs. own product).
