# Hybrid Groovebox — Augment-Model Plan

A groovebox that drives **Ableton Move's real engines** (Drift / Wavetable / Drum &
Melodic Sampler) **live** *and* hosts our **own open (moveforge) engines**, under one
cohesive UI — by running as a takeover layer on top of a running `MoveOriginal`.

This is the **augment** counterpart to **Overture** (`docs/GROOVEBOX.md`), which is the
*standalone* groovebox on open engines only. The two are different architectures and don't
merge — see `docs/ABLETON-ENGINE-ACCESS.md`. Pick augment when **Ableton's sound, live** is
the priority; pick Overture when **independence + arbitrary control** is.

## ⚠️ Prior art: dAVEBOx — read this first; it changes the build strategy

**~80% of this already exists, shipping**, as `legsmechanical/schwung-davebox` (cloned at
`~/src/move-spike/schwung-davebox/`): an 8-track sequencer (4 Move + 4 Schwung slots + external)
built as a **schwung tool module** (+ small capability-gated patches, most now upstream in schwung
v0.9.16). Read its `docs/SCHWUNG_DAVEBOX_LIMITATIONS.md` and `docs/SCHWUNG_PATCHES.md` — they answer
most of our open questions:
- **Module, not host fork.** A `component_type:"tool"` module carries the whole 8-track sequencer.
  Needed host capability is upstream or capability-gated. Our "graduate to a host fork" worry was
  overblown — likely never needed.
- **By-channel routing to 4 Move tracks works** (`ROUTE_MOVE` = `midi_inject_to_move`, cable 2, by
  channel). Our #1 make-or-break Phase-0 question is answered *yes* by a shipping product.
- **Editing/browsing solved by "co-run"** (`schwung/docs/CORUN.md`, `shadow_corun_begin/end`): hand
  the OLED + nav controls to **Move's own native device-edit / preset-browser** inside the tool while
  the sequencer keeps playing (`Edit Synth...`). This **replaces our shadow-scrape/puppeteer plan for
  the *editing* case** — cleaner and far less fragile (it *is* Move's UI).
- **Audio is MIDI-only → route to Schwung slots.** Don't host engines/mix audio yourself; open synths
  live in Schwung slots (now 4 audio-FX + send buses A/B + master FX). Drops the "fork host for audio"
  idea entirely.
- **Gotchas solved + documented:** hung notes on Move (§10 `pfx`-queue-in-`render_block`), echo-cascade
  crash (§12 cable-2 remap), coalescing, LED per-tick budget (§14), persistence (state v36 + export to
  Live), pad-drop self-heal. Treat the limitations doc as the field guide.
- **Poly-AT already done:** davebox sequences per-clip **pad-pressure (aftertouch) automation** to Move.

**What's still ours:** dAVEBOx provides the substrate: notes/velocity/poly-AT to Move, Schwung/open
tracks, co-run editing, persistence, and export. Move itself already has native per-step parameter
automation, so Overture's wedge is not "Move lacks p-locks." The wedge is unified depth: one
8-track timeline for Move engines plus Schwung/open tracks, with dAVEBOx sequencing depth and a
Move-like surface.

**Revised strategy:** build **on / fork dAVEBOx** (check its `LICENSE` first), and focus effort on the
hybrid UX, route clarity, parameter discoverability, and Move-like editing shortcuts rather than
rebuilding the sequencer, routing, co-run editing, and persistence it already has.
The sections below remain the design reference (and apply if you build fresh), but reuse is the smart
default. Note: davebox targets `move.local` (systemd/Armbian deploy); our device is `move-em.local` —
reconcile environments.

---

## What we proved (the foundation — on-device, 2026-06-06)

Verified by injecting MIDI into a running `MoveOriginal` and measuring its USB-audio output:

| Into Move's real engines, live | Status |
|---|---|
| Notes / velocity | ✅ works |
| Polyphonic aftertouch (per-note pressure) | ✅ measured (16 dB voice mod; Drift/Wavetable pressure-mapped presets) |
| **Device-parameter automation (p-locks)** | ✅ measured — **cable-0 encoder CC** swept a Drift "Hi-Pass Freq" hands-off |
| Pitch bend / CC74 / channel-AT | ❌ flat (CC unsupported by design) |

So the live Ableton-engine palette is **notes + velocity + poly-AT + positional p-locks**.
Full evidence + method in `docs/ABLETON-ENGINE-ACCESS.md` ("Deep-dive follow-up").

## Hard constraints (can't engineer around — sealed in MoveOriginal)

- **Exactly 4 Ableton-engine tracks.** They live in MoveOriginal's Set model; we can't spawn
  a 5th. Our *own* hosted tracks are unbounded (CPU-limited).
- **Parameter addressing is positional**, not by id: injecting encoder CC 71–78 moves whatever
  knob 1–8 maps to **on Move's current device view**. To automate a specific param we must
  first navigate Move so it sits under a knob.
- **MoveOriginal must keep running** — we layer, never replace. No Ableton engines without it.
- Per-step preset changes and arbitrary param/macro addressing on the Ableton side are out.

---

## Architecture

### The core abstraction: a track has a *kind*

```
track_t {
    enum { ABLETON, HOSTED } kind;
    // ABLETON: a remote control over one of Move's 4 tracks
    int    move_track;        // 0..3 (which Move track this puppets)
    // HOSTED: one of our own moveforge module instances
    module_inst *inst;        // plugin_api_v2 instance (NULL for ABLETON)
    // common
    pattern_t pattern;        // steps: note/vel/pressure/(p-lock targets)
    float  volume; bool mute, solo;
}
```

**Kind is per-track, and the Ableton engines are a *pool*.** There are two resource pools: **≤4
Ableton-engine slots** (Move's tracks 0–3, fixed) and **unlimited hosted slots** (CPU-bound). Any UI
track claims either — so tracks **1–4 can each be Ableton *or* a schwung module**, and tracks beyond 4
are hosted-only (no Ableton track exists for them). A slot flipping kind just swaps its data backend;
the UI/widgets don't change. This also load-balances: an Ableton slot's DSP is borne by MoveOriginal,
a hosted slot's by us — so Ableton slots are the cheaper choice for *our* budget (see Performance).

The whole UI is uniform; **routing differs per kind under the hood**:

| Operation | `ABLETON` track | `HOSTED` track |
|---|---|---|
| **Select** | puppeteer Move: inject track-select (CC 40–43) + navigate to its device view | just set our focus |
| **Play note** (from seq/pad) | inject NoteOn/Off (+vel, +poly-AT) to Move's track | `dsp_host_midi(inst, …)` |
| **Param / knob** | inject **encoder CC** (cable 0, delta) → positional on Move's view | `set_param(inst, key, val)` directly |
| **Audio** | capture Move's per-track output via **Link Audio**, meter/mix | render `inst` block, mix |
| **Mix** | sum Link-Audio track + our tracks → DAC out (reuse shim gain-staging) | same |

### The key design problem: the 4 Ableton tracks are *puppeteered*

For HOSTED tracks we own everything. For ABLETON tracks our UI is a **remote control over
Move's internal selected-track + view state**, because note routing and (especially) p-lock
addressing depend on it. So "select Ableton track 2" must silently drive Move (inject
track-select + enter device view) while *we* keep drawing our own screen. The art is hiding
that asymmetry so the user feels one cohesive instrument.

### Reused schwung pieces (don't rewrite)

- **Shim** (`schwung_shim.c`) — SPI `ioctl` interception, audio mix, display ownership, RT safety.
- **Inject path** (`shadow_midi.c` → `shadow_chain_midi_inject`) — what we drove engines with.
- **Module host** (`schwung_host.c`, `chain_host.c`, `plugin_api_v1.h`) — for HOSTED tracks.
- **Link Audio** (`link_subscriber.cpp`, `shadow_link_audio.c`) — Move's per-track audio in.
- **FORKING.md** — fork-flag allocation (`reserved16`), upstream-tracking guidance.

---

### Display & state model — one UI, two backends

In overtake **we own the 128×64 display**; Move's own UI is hidden. So tracks 1–4 (Ableton) are
not "shown via Move's screen" — they're **represented in our own widgets via a shadow model**,
drawn by the **same renderer** as tracks 5–8. The user sees one consistent surface; only the data
plumbing behind each widget differs.

**Reading real Ableton values (we can — to seed + resync):**
- `Song.abl` (the Set, plain JSON) holds every device's `parameters` (id + value), `presetUri`,
  and macro mappings → read it (file API or `/data`) to **seed accurate values for all 4 Ableton
  tracks** at load.
- Live edits not yet persisted: call D-Bus `com.ableton.move.SongRenderer.saveSongIfDirty` to
  flush, then re-read.
- **No per-frame live param-read API exists** (engine has no symbols / no D-Bus param interface;
  the display shows only the *focused* param, as a bitmap). So the model is: **seed from `Song.abl`
  → track live deltas in the shadow model as we drive params → reconcile the focused param from a
  display read only when precision matters** (shadow value can drift because encoder control is
  relative/non-linear).

**Uniform `track_view` + param descriptor (the consistency mechanism):** one view-model and one
renderer; each track *kind* fills it from a different source:

| `track_view` field | ABLETON (1–4) | HOSTED (5–8) |
|---|---|---|
| engine / preset name | `Song.abl` `presetUri` | `module.json` |
| 8 knob params (name/range/unit/value) | Phase-0 knob→param map + `Song.abl` values + shadow deltas | `module.json` `ui_hierarchy.knobs[]` / `chain_params` + `get_param` |
| pattern / steps | our sequencer | our sequencer (same) |
| mute / solo / volume / pads | ours (same) | ours (same) |

The leverage: schwung modules **already** ship structured param metadata (`knobs[]`, labels,
`type/min/max/step/unit`). Build the **same descriptor shape for the Ableton engines** once (the
Phase-0 characterization links encoder position → param id; `Song.abl` gives that param's
value/range) → a single render + input path drives both identically. A knob turn updates
`track_view.param[N]`; focused track ABLETON → inject encoder CC; HOSTED → `set_param`. Same
gesture, same widget, different backend.

**Exception — preset *browsing*:** changing an Ableton preset is the one rich action where you'd
either reimplement a simple browser over the preset-library files, or briefly surface Move's own
browser. Playing/sequencing/param-tweaking (the 95% case) is fully covered by the shadow model.

### FX & master bus

Two FX layers, chosen per track kind — it's the same "free-but-in-chain vs full-control-but-round-trip"
trade-off as engines, applied to effects:

- **Ableton FX** (in Move's device chain, + return/master tracks) — for ABLETON tracks. **Free to our
  budget** (Move renders them), authentic; an FX device's params *are* device params, so they're reached
  by the **same positional p-locks** and seeded from `Song.abl`. *Adding/removing* an FX device is
  structural (browse-tier), like presets.
- **schwung FX** (`audio_fx` modules) — **native on HOSTED tracks** (in-chain, cheap, full control). Can
  *also* process an ABLETON track's audio, but only by capturing it via Link Audio + recompositing
  (`rebuild_from_la`) — pay the round-trip cost/latency; do it only when you want open/custom FX or fully
  arbitrary control on that track.

**Master FX** — schwung's 4-slot Master FX is available in the hybrid:
- **Default (no round-trip):** schwung MFX covers **our** side (hosted tracks + overtake DSP); Move's mix
  gets **Ableton's own master FX** (free); the two **sum at the DAC**. Two master buses, composited.
- **Unified (round-trip):** to run schwung MFX over the **whole** mix incl. the 4 Ableton tracks, use
  rebuild mode (Move's audio captured through it). Forking the host means you own this final-mix topology
  (4-slot MFX + ME-bus gain-staging are reusable schwung machinery).

All FX params fold into the uniform `track_view` descriptor (Ableton via characterization + `Song.abl`;
schwung via `module.json`) → editing any effect looks the same; only structural FX add/remove on the
Ableton side is browse-tier.

### Transport, timing & latency

- **Transport ownership: Move's transport stays OFF; we sequence everything live via injection**
  (Move = sound module only). Otherwise Move's own clips/transport fight our sequencer (observed as
  a confound during testing). Our clock drives both Ableton (injected) and hosted tracks.
- **Latency parity is the core cohesion problem.** Hosted tracks render locally (~0 ms); Ableton
  tracks go *our-inject → Move-synth → out* (~5–14 ms + inject defer). Same-step events across kinds
  must align or the groovebox feels broken. Mitigation: schwung's **Latency Comp** already delays
  local synths to match Move's late audio — the right direction; **must be validated for this exact
  pairing** (injected-Ableton vs local-hosted) early.
- **Note-off safety.** The inject path rate-limits (8–16/tick) and defers around hardware events;
  dropped note-offs = hung notes on Move's tracks. schwung's drain has carryover — confirm it holds
  under a dense 4-track pattern.
- **Note timing jitter** from the drain/defer must be inaudible at tempo — measure.

### Persistence

A hybrid "set" spans two worlds: **Move's Set** (`Song.abl` — Ableton tracks' presets/params, flushed
via `saveSongIfDirty`) **+ our own state** (patterns, hosted-module instances/params, tempo, per-slot
track-kind assignments, knob-map cache). Save writes both; load restores both. Treat as a first-class
design item, not an afterthought.

## Performance & RT budget

**The takeover layer is cheap; cost scales with hosted-track DSP, not with running over Move.**
MoveOriginal + its 4 engines run regardless (the device's normal state). The overtake glue (I/O
intercept, 1-bit display draw, sequencer, MIDI inject) is near-free. Ableton tracks cost us nothing
extra (Move synthesises them). **Only HOSTED tracks add load we bear.** schwung already runs "Move +
shadow synths" within budget, so the architecture is proven — you tune the hosted load.

**The wall:** CM4, **4 cores**, RT kernel. SPI/audio callback = **SCHED_FIFO 90 on core 3**, 128
frames @ 44.1 kHz = **~2.9 ms/block**, ~900 µs compute after the transfer. (For scale: the engine
renders ~0.45 ms for 1 Drift track.) Total system load = Move's active engines + our hosted modules,
all on cores 0–2; core 3 stays for SPI.

**On Move, the failure mode is glitches (xruns), not gradual slowdown** — usually from RT-safety
violations, not raw CPU. So RT hygiene matters more than throughput.

Rules:
1. **Core discipline.** Keep **core 3 free for SPI**; pin hosted-DSP work to cores 0–2 (`taskset 0x7`).
   Don't fight MoveOriginal's audio thread; respect FIFO priority-inheritance (child procs reset to
   `SCHED_OTHER` before exec — `shadow_process.c`).
2. **Don't round-trip Move's audio unless you must.** Capturing Move's per-track audio via Link Audio
   (to FX/meter it) has real cost + latency. If you only need to *sum* your hosted tracks on top, **let
   Move's audio pass straight through the mailbox** ("clean-idle leaves Move's mailbox untouched") and
   only reconstruct the specific tracks you actually process.
3. **Budget + cap hosted voices/tracks** to fit ~900 µs/block; profile each module's per-block cost.
   Prefer Ableton slots for sounds you don't need to own (they're free to *our* budget).
4. **Cheap UI.** Dirty-flag the display (redraw on change only); keep all UI/file work off the RT path.
5. **Strict RT-safety in the audio callback:** no allocation, no I/O, no logging, no cross-thread locks
   (`schwung/docs/REALTIME_SAFETY.md`).
6. **Lean modules** (Faust-compiled / optimised) when running many hosted tracks.

Rule of thumb: "4 Ableton + a few hosted" ≈ what schwung does today → fine; "many heavy hosted synths"
is where you approach the budget — measure and cap.

## Phasing — start as a module, graduate twice (superseded)

> ⚠️ **SUPERSEDED — see `ROADMAP.md` for the authoritative phase plan.** The phasing below is the
> *build-from-scratch* alternative, written before we found dAVEBOx. The actual plan is the
> **davebox-fork** path in `ROADMAP.md`, now reframed around unified hybrid sequencing. Keep the
> phases below only as the fallback if you ever build fresh instead of forking.

### Phase 0 — Validate the unknowns (overtake module, ~harness)
Extend the `engine-probe` harness to answer, on-device, the questions that change the design:
1. **Note routing — by-channel or selected-track-only?** Inject notes on ch 1–4 *simultaneously*;
   do all 4 Move tracks sound at once, or only the selected one? (Decides whether a 4-track live
   sequencer is even possible without rapid track-switching. schwung docs imply by-channel works —
   confirm.)
2. **P-locks while overtaken.** Does encoder-CC injection move the right param when **our** UI owns
   the display and Move's device page is only internal state (not drawn)? If it needs Move's page
   *visible*, the seamless-display model breaks — find out now.
3. **Multi-track + p-lock rate budget.** Notes on 4 tracks + param sweeps within the drain's
   8–16 pkt/tick cap — how dense can patterns + automation get before drops?
4. **Positional param map.** For a given device view, which knob (CC 71–78) maps to which param,
   and is it stable enough to address predictably? (Build the per-device knob→param table here.)
5. **State read.** Can we read accurate Ableton param values to seed the shadow model — parse
   `Song.abl` device `parameters`, and does D-Bus `SongRenderer.saveSongIfDirty` flush live edits
   to disk first? (The display/state model depends on this.)
6. **Latency parity (make-or-break).** Measure the timing offset between an injected note on an
   Ableton track and a locally-rendered hosted note on the same step; confirm schwung's Latency Comp
   can align them to ~sample accuracy. If not, mixed-kind sequencing is compromised.
7. **Note-off + timing under load.** Run a dense 4-track pattern: any hung notes (dropped note-offs)?
   Is injected-note timing jitter inaudible? Confirms the drain/carryover holds for real patterns.
8. **Preset load on an Ableton track.** Is `LoadDevicePreset` / browser-puppeteering a clean way to
   change an Ableton track's sound from our UI, or painful? Gates "choose your Drift patch."
**Done when:** we know whether 4 simultaneous Ableton tracks + p-locks-while-overtaken work, and
the realistic rate/density ceiling.

### Phase 1 — Groovebox MVP as a manually-loaded overtake module
4 Ableton tracks only. Track buttons 1–4 select; pads play; a 16-step sequencer injects
notes(+vel+pressure); knobs drive params via positional encoder-CC; display shows the unified
track/step/knob UI. Deploy via `install.sh install-module`, launch from Tools.
**Done when:** you can sequence a 4-track pattern on Move's real engines from your own UI, with
per-step note + at least basic param automation, all under your interface.

### Phase 2 — Add HOSTED tracks (5–8) — still a module
Shift + track buttons bank to tracks 5–8 = your moveforge modules (the overtake module
`dlopen`s them). Notes/params route the HOSTED way; audio mixes with Move's Link-Audio tracks.
**Done when:** an 8-track set (4 Ableton + 4 hosted) sequences and mixes as one instrument.

### Phase 3 — *Graduate hosting*: fork the host (ONLY if needed)
If the leaf-module form can't carry the multi-module chains / per-track FX / mix topology you
want, fork `schwung_host.c` and move the groovebox up to host level. Skip this if Phase 2 suffices.

### Phase 4 — *Graduate boot*: boot straight to the groovebox (LAST)
Own the launch seam (`/opt/move/Move` = schwung's `shim-entrypoint.sh`; chain is
`MoveLauncher → /opt/move/Move → MoveOriginal+shim → schwung-manager`). Auto-enter your overtake
on startup (a `reserved16` fork flag / `JUMP_TO_OVERTAKE`-style trigger) once the engine is up.
**Risks:** boot-chain edits can brick boot — rely on schwung's `schwung-heal.c` atomic-rename +
self-heal, keep a full `/data` backup + Pi-Imager reflash path ready. Sequence auto-launch only
after Move's engine has initialised, and mask the brief Move-boot moment.
**Done when:** power-on lands directly in the groovebox; MoveOriginal runs invisibly underneath.

---

## Open risks / things to keep honest about
- **P-locks may be slow/serial across tracks.** Positional addressing means automating track 2's
  cutoff requires Move selected+viewing track 2's device page; doing this across 4 tracks per step
  may be rate/latency-bound. Phase 0 must measure how parallel/fast this really is — it may be
  "one track's param sweep at a time," not full per-step-per-track p-locks.
- **Display contention** if p-locks need Move's device page visible (Phase 0 Q2).
- **Preset/FX-device loading on Ableton tracks** is browse-tier (structural, not a param) — may be the
  fiddliest UI piece; spike it early (Phase 0 Q8).
- **Pad/step LED feedback map** unconfirmed (velocity→colour, playhead) — pin the LED protocol for
  legible feedback (also flagged in Overture notes).
- **Licensing**: confirm schwung's licence terms before distributing a fork (own-device use vs ship).
- **Recovery**: every device session — full `/data` backup first; reflash path known.

## Dev loop (build / deploy / test) — the runbook we proved this session

Device: `ableton@move-em.local` (root ops use `root@`; key `~/.ssh/id_ed25519`). Note
`MOVE_HOST` in `~/src/move-spike/.mise.toml` is **host-only** (`move-em.local`) — scripts add the
user; install.sh needs `--host=move-em.local`. **No `timeout`** on the Mac *or* the device (busybox).

```bash
# 1. BUILD a tool module → aarch64 dsp.so (Docker has the cross toolchain)
cd ~/src/move-spike/schwung
docker run --rm -v "$PWD:/build" -u "$(id -u):$(id -g)" -w /build schwung-module-builder:latest \
  aarch64-linux-gnu-gcc -O2 -shared -fPIC -Isrc \
  src/modules/tools/<id>/dsp/<id>.c -o build/modules/tools/<id>/dsp.so -lm

# 2. PACKAGE (COPYFILE_DISABLE avoids macOS ._ junk that litters the module dir)
rm -rf build/pkg && mkdir -p build/pkg/<id>
cp src/modules/tools/<id>/module.json src/modules/tools/<id>/ui.js build/modules/tools/<id>/dsp.so build/pkg/<id>/
COPYFILE_DISABLE=1 tar --no-xattrs -czf build/<id>-module.tar.gz -C build/pkg <id>

# 3. DEPLOY (root-extracts into modules/tools/ + chowns; do NOT loose-scp)
./scripts/install.sh install-module ./build/<id>-module.tar.gz --host=move-em.local

# 4. RELOAD + logs
ssh ableton@move-em.local 'sh /data/UserData/schwung/restart-move.sh'
ssh ableton@move-em.local 'touch /data/UserData/schwung/debug_log_on'
# tail (no `timeout`; background + remote sleep/kill):
ssh ableton@move-em.local 'sh -c "tail -n0 -f /data/UserData/schwung/debug.log & p=\$!; sleep 20; kill \$p"' | grep -iE "inject|drained|error"

# 5. OBJECTIVE AUDIO TEST (Move must be USB-C connected → appears as "Ableton Move Audio")
ffmpeg -f avfoundation -list_devices true -i "" 2>&1 | grep -i audio    # find the device index N
ffmpeg -hide_banner -loglevel error -f avfoundation -i ":N" -t 8 -ac 2 -ar 44100 /tmp/cap.wav
# analyse in python3+numpy: autocorr pitch / spectral centroid / RMS, look for the probe's step
# period. For a square-wave probe (flip every T s), the tell is NEGATIVE autocorr at T (half
# period) + alternating run-lengths ~T — not positive autocorr. (engine-probe Mode A = expr,
# Mode B = encoder-CC p-lock.)
```

Module skeleton + injection byte format (cable 2 = track MIDI; cable 0 = hardware/encoders;
CIN per status nibble): `schwung/src/modules/tools/{engine-probe,seq-test}/` and
`schwung/docs/ADDRESSING_MOVE_SYNTHS.md`. Knobs are **relative**: CC value 1..63 = +N, 65..127 = −N.

## Fragility & maintenance

**Key principle: fragility ∝ how deep a feature reaches into MoveOriginal's *undocumented internals*.**
What you own + the stable Move seams are robust; puppeteering the Ableton side is brittle. Main trigger
is **firmware updates** — between them it's stable.

**Most fragile (the maintenance burden):**
- **Positional p-locks + knob→param characterization** — depends on Move's view-tree param layout
  (which params on which page). A firmware update can silently *shift the map* → you automate the wrong
  param. Regenerate per firmware; structural view changes may need rework. Fragile on 3 axes: param
  layout, encoder protocol, UI-nav flow.
- **Preset / FX-device loading** — browser-puppeteering depends on Move's browser UI + library layout.
- **Display text reading** (if used for value/label reconcile) — bitmap OCR breaks on font/layout change
  (degrade to shadow model).

**Moderately fragile (schema/API drift — mitigable):**
- `Song.abl` parsing (schema is versioned — parse lenient, read only needed fields).
- D-Bus calls (`saveSongIfDirty` etc. are **private** interfaces — wrap, fail gracefully).
- Latency-comp tuning (empirical; may need re-tune per firmware).
- Boot chain — **every firmware update overwrites `/opt/move`** → reinstall required (schwung-heal +
  reinstall flow); plus brick risk. High-consequence, low-frequency.

**Least fragile (build freely here):**
- The SPI shim + mailbox layout (hardware protocol; rare changes; upstream schwung maintains).
- Note / velocity / **poly-AT** injection (stable format; inject race already solved).
- **Everything you own** — hosted tracks, sequencer, UI, mixing — not fragile at all.

**Mitigation stance:**
- **Pin a known-good firmware**; treat updates as deliberate "re-validate + regenerate knob-map" events
  (schwung already version-targets Move).
- **Auto-regenerate the characterization** on firmware-version change; don't hardcode it.
- **Shrink the fragile surface:** e.g. *don't* build programmatic Ableton preset-loading early — let
  users pick Ableton sounds in stock Move first; the groovebox just plays + automates them.
- **Degrade gracefully:** if the knob-map fails a sanity check, fall back to "notes + poly-AT only" on
  Ableton tracks rather than driving the wrong param.

**The reassuring part:** the core groove — sequencing notes+velocity+poly-AT into Ableton's engines,
plus your own hosted tracks — rides on the **robust** seams. The fragile features (live p-locks, preset
switching) are *enhancements* you can ship without or treat as best-effort. Fragility threatens the
cherry, not the cake.

## References
- `docs/ABLETON-ENGINE-ACCESS.md` — what's reachable + the measured evidence + `engine-probe`.
- `docs/GROOVEBOX.md` — Overture (the standalone, open-engine counterpart).
- `schwung/CLAUDE.md`, `schwung/docs/{ADDRESSING_MOVE_SYNTHS,FORKING,SPI_PROTOCOL}.md`.
- Memory: `move-live-engine-seams.md` (measured capabilities + reusable USB-audio test method).
