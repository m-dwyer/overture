# Using Ableton Move's Real Engines — Findings

Investigation: 2026-06-06. Question: **can our own groovebox software use Ableton Move's
real synth engines (Drift, Wavetable, Drum Sampler, Melodic Sampler)?** Verified
empirically on a real device (`move-em.local`, a CM4 Move) and against a full local copy
of the device filesystem at `~/src/move-spike/move-fs/device-full/`.

## TL;DR

- The engines are **statically compiled into the Move binaries with zero exported symbols
  and no shared library anywhere on the device** — you cannot link, `dlopen`, or call them
  from your own process. (Confirmed across the *entire* filesystem, not just `/opt/move`.)
- **Live** real-engine sound in your own groovebox is only possible by **injecting MIDI into
  a running MoveOriginal** (the schwung "augment/overtake" model). Notes/velocity/bend/
  aftertouch only — no per-step engine-parameter automation, and Move owns its tracks.
- **Offline** "render an arbitrary composition through the real engines to audio" is fully
  solved, **two independent ways** (HTTP render API, or EnginePerfTool CLI). Both proven.
- There is **no** configuration in which a standalone app you fully control runs Ableton's
  engines live with full automation. That combination is physically blocked.

## The three capabilities

| Goal | Mechanism | Live? | Own the groovebox? | Limits |
|---|---|---|---|---|
| Real engines **played live** | Overtake module → inject MIDI into running MoveOriginal | ✅ | Your UI/seq; Move's engines | Notes only; no p-locks; Move must run |
| Real engines **bounced** (render arbitrary song → WAV) | HTTP render API **or** EnginePerfTool CLI | ❌ offline | You author the Set | Move must run (for the API) |
| **Full live control**, own everything | Standalone + open moveforge engines | ✅ | ✅ | Not Ableton's engines |

---

## Offline render — TWO working paths (both proven)

Both render a complete, arbitrary `Song.abl` through the **real** engines (all tracks,
instruments, effects, and parameter/per-note automation as authored).

### Path A — Official HTTP render API (MoveWebService, port 80)

This is what Move Manager's "export to audio" uses. Needs an auth cookie; runs while Move
is on (the `com.ableton.move.SongRenderer` service is registered in-process by MoveOriginal).

```
# 1. Auth (6-digit code shows on the Move screen)
POST /api/v1/challenge                              -> shows code
POST /api/v1/challenge-response {"secret":"CODE"}   -> sets Ableton-Challenge-Response-Token cookie
# 2. List sets (objectId == the set UUID under /data/UserData/UserLibrary/Sets/<uuid>/)
GET  /api/v1/data/Sets                              -> {objects:[{objectId,bucket,name,...}]}
# 3. Start render  (** MUST send an empty body / Content-Length: 0 **)
POST /api/v1/render/<objectId>?format=wav          -> 202 {"id":N,"href":"/api/v1/render/N"}
# 4. Download  (poll SSE GET /api/v1/render for {id,status:"finished"}, or just GET the href)
GET  /api/v1/render/<id>                            -> 200 audio/wav  (32-bit float, 44.1k stereo)
# cleanup: DELETE /api/v1/render/<id>
```

**Gotcha:** the POST needs an explicit empty body (`curl --data ''`). Without it, httplib
returns a bare, unlogged `400`. Formats: `wav` (default), `ogg`, `mp3`/aiff likely.

**Proven:** rendered "BNYX Demo 3" → 65.1 s, peak 0.966 (real, loud, multi-track audio).

### Path B — EnginePerfTool CLI (no auth, on-device)

`/opt/move/EnginePerfTool` statically embeds the same engine. It renders a loaded `Song.abl`
to a WAV — **but only plays clips marked launched.** The launch state is the
**`"isPlaying": true`** field on the clip (discovered from `/opt/move/BenchmarkSongs/*.abl`,
which the perf harness loads and plays). Generated/`--save-song` songs and normal user Sets
lack this field → they render **silent**.

```
# author Song.abl, set "isPlaying": true on the clip(s) you want to sound, then:
EnginePerfTool --fake-driver --render-audio --audio-output out.wav \
  --duration <frames> --no-realtime-priority --no-memory-locking song.abl
```

**Proven:** identical authored song rendered SILENT without `isPlaying`, REAL AUDIO (0.065)
with `isPlaying:true` + custom notes.

Notes on EnginePerfTool:
- `--fake-driver` renders to a file (offline, safe alongside Move). Without it, audio API is
  "Move" → it opens `/dev/ablspi0.0` for the real speaker (conflicts with running Move).
- Render speed: `--fake-driver` throttles to realtime; with `--untimed-sleep` it's ~1.9×
  realtime (1 Drift track) / ~1.5× (4 tracks). The engine itself computes a buffer in
  ~0.45 ms vs the 2.9 ms budget (~6× headroom) — the cap is the tool's inter-buffer sleep.
- `--preset`/`--alt-preset` pick the patch; `--automate-parameter d[0].c[1].d[1].p[Cutoff]`
  + `--automation-pattern step-editing` and `--automate-per-note-cc` give full automation /
  p-locks **in the render**.
- `--config FILE` is just a boost `program_options` file (same flags), **not** a hidden-
  feature config. No live-MIDI input option exists.

---

## Live engine access — why only via MIDI injection

The engine is fed live by exactly one thing: **MoveOriginal reads MIDI_IN from the SPI
mailbox every frame and routes it to its engine.** That routing is the only "live MIDI →
real engine" wiring on the device. So:

- **Your groovebox plays the real engines live** by running as a schwung **overtake module**
  (you own pads/display/LEDs/sequencer) and **injecting note MIDI into MoveOriginal's
  MIDI_IN** (channel = Move track). Move renders it to the speaker. Proven pattern; see
  `schwung/docs/ADDRESSING_MOVE_SYNTHS.md` and `tools/seq-test`.
- **Limits:** notes/velocity/pitchbend/aftertouch — **plus live per-note expression** (see
  next bullet). Move has no MIDI CC→parameter mapping and no external param-control RPC →
  **no per-step *global* parameter automation (p-locks) on the real engines live**. Patch
  changes are whole-preset (`LoadDevicePreset`), not per-step.
- **Polyphonic aftertouch IS a live expression seam (EMPIRICALLY VERIFIED on device).** Of the
  continuous controllers, **only poly-AT reaches the voice** via cable-2 injection — measured by
  capturing Move's USB audio while a probe held a note and stepped poly-AT 0↔127 every 0.743 s:
  the voice tracked it with a **16 dB volume swing locked to the square** (`engine-probe`, below).
  This matches the manual (§4.1.3): *"Move can receive polyphonic aftertouch; monophonic
  aftertouch, MIDI CC, and MIDI mapping are not supported."* Caveats: only **Drift/Wavetable**
  patches that **map pressure** respond (a basic saw shows nothing); routes to whatever the
  preset maps (volume/timbre), per-note.
- **CC74, pitch bend, channel-AT do NOT reach the voice (measured flat).** Despite the engine
  containing `mMidiPerNoteCC74`/`mMidiPerNotePitchBend` strings, injected channel CC74 and pitch
  bend produced **zero** voice change on a static saw (pitch flat to ±0.07 semitone; brightness
  flat). MIDI CC is **unsupported by design** (manual). The engine's per-note CC/bend path is fed
  by Move's **own pads via the internal protocol**, not by cable-2 channel MIDI. So: notes +
  velocity + **poly-AT** is the live palette; no live CC/bend/p-locks via injection.

### Why EnginePerfTool is NOT a live instrument

It contains the real engine and can drive the real speaker on the bare SPI, but it is a
**benchmark/stopwatch**: it plays a fixed song and **never reads the SPI MIDI-in slot**.
Tested on bare hardware (Move stopped): audio came out (a sustained Drift saw = "buzz"), but
**pressing the pads did nothing** — it owns the speaker yet is deaf to live input. No CLI
flag and no config file expose live MIDI in.

### Why we can't reverse-engineer our way to live standalone

- **Can't link/extract:** no engine `.so` anywhere; binaries are stripped, static C++ with
  vtables, a custom allocator (tcmalloc), and the voices are objects driven by the engine's
  node graph (EngineCoreLib) + ResourceManager + flip model. Reanimating that from a stripped
  binary is a multi-month, firmware-fragile effort with low odds.
- **Clean-room rewrite** = just building your own engine = the open-moveforge path; you won't
  match Ableton's sound, so no advantage (plus IP risk).
- RE pays off only for **boundaries** (SPI protocol, MIDI cabling, Link Audio, kernel ABI —
  all already done by schwung/move-spi-armbian). The engine is not a boundary; it's a sealed
  implementation. The one tractable boundary (routing injected MIDI to Move tracks) is the
  augment path and is already solved.

---

## The `Song.abl` set format (useful for both render paths)

A Move Set is `<uuid>/<name>/Song.abl` — **plain JSON**, schema
`http://tech.ableton.com/schema/song/1.8.2/song.json` (namespace only; not fetchable).

- Top level: `stepEditorResolution, tempo, globalGrooveAmount, rootNote, scale,
  melodicLayout, tracks, returnTracks, masterTrack, scenes, grooves, metadata`.
- Track: `kind, name, clipSlots, devices, mixer, midiInputMode, midiOutputEndpoint, ...`.
- Clip: `name, region {start,end,loop}, notes[{noteNumber,startTime,duration,velocity,
  offVelocity}], envelopes[{parameterId, breakpoints[{time,value}]}], grooveId` — plus
  **`isPlaying`** (the launch flag; required for EnginePerfTool to sound it).
- Device chain: `instrumentRack → drumRack`, `parameters` (e.g. Drift `Filter_Frequency`
  20–20000, `Filter_Resonance`, `Oscillator1_Type`, macro mappings), `presetUri`.
- **Automation / p-locks** are `envelopes` on the clip: paired breakpoints at the same time
  make instant step jumps. Proven: a cutoff envelope audibly steps the real Drift filter
  (4.7× brightness swing vs. a flat control) in a render.

---

## Device / filesystem facts

- Hardware: Raspberry Pi **Compute Module 4** (BCM2711), kernel `5.15.92-rt57-v8` (RT),
  SPI driver `ablspi.ko`. Boot: `boot/bcm2711-rpi-cm4.dtb`, `config.txt`, `cmdline.txt`.
- Full device copy: `~/src/move-spike/move-fs/device-full/` (1.3 GB, 15,211 files; whole
  root + `/data`, minus virtual fs). `/opt/move` also at `move-fs/opt-move/`.
- Lib stack (from `/opt/move/licenses/`): `flip` (Song model), `cpphttplib` (render server),
  `sqlite` (SongRendererDatabase), `ne10`/`eigen` (DSP), `bungee` (warp), `link`, `rtmidi`/
  `rtaudio` (I/O backends — present but not wired for live on the Move), `libmp3lame`.
- `/opt/move/Move` is the schwung shim-entrypoint (LD_PRELOAD into MoveOriginal); it can
  start `schwung-manager` (:7700) and, if enabled, `filebrowser` on **port 404 `--noauth`**.
- `/www` = the **SWUpdate** firmware-update UI (separate from Move Manager on :80).
- Recovery: reflash via Raspberry Pi Imager (select **Raspberry Pi 4**), eMMC = `mmcblk0`
  (~58 GB) exposed via rpiboot. Re-enable SSH: `POST /api/v1/challenge` → on-screen code →
  `POST /api/v1/challenge-response` → `POST /api/v1/ssh` with cookie + raw pubkey.

## Recommendation for the groovebox

- **Want the real Ableton sound, live** → overtake module driving Move's engines via MIDI
  injection. Accept: notes only, no p-locks, Move underneath.
- **Want full control / p-locks / standalone** → open moveforge engines. Accept: not
  Ableton's engines.
- **Best of both** → sequence live on open engines, and offer a "render through Ableton
  engines" button using either render path above for the final bounce. The legible
  `Song.abl` JSON + `isPlaying` make authoring the render input straightforward.

There is no fourth option. Pick per-feature; don't expect one instrument to be standalone,
fully-controllable, *and* use Ableton's real engines live.

---

## Deep-dive follow-up (2026-06-06): live real-time re-examination

A second, evidence-based RE pass (RTTI-xref counting, PLT/dynamic-symbol enumeration,
disassembly of the perf-tool drive loop, string verification re-run against the binaries)
stress-tested the "live standalone is physically blocked" verdict. Net: the verdict holds
for *global* live control, but two points above needed correcting and one frontier remains
genuinely open.

### Corrected: EnginePerfTool can't be a persistent live host (stronger evidence)
Earlier framing ("benchmark/deaf") was right for the wrong-ish reason. Two hard blockers,
both verified:
- **Bounded runtime.** The drive loop is a render-N-frames-then-exit benchmark: the
  iteration test compiles to `cmp; b.lt` whose taken branch is the function epilogue/`ret`,
  sized by `--duration`. No "loop/continuous/interactive/forever" mode exists. (`--loop`/
  `--steps` refer to the musical clip loop, a `flip_model::FLoop` field, not an app run-loop.)
- **Live-input node is dormant dead code *here*.** `FromMidiEndpointsNode` and
  `ExternalInputNode<EndpointedMidiMessage>` (the nodes that consume live MIDI) have **0
  construction xrefs** in EnginePerfTool — no emitted typeinfo/vtable, only template/RTTI
  litter — versus **2,199–2,371** xrefs for the output-side `ToMidiEndpointNode`/
  `MidiEndpointDiscarderNode`. The perf tool builds tracks only from *generated* clips +
  pre-baked envelopes. So splicing SPI MIDI-in cannot reach the voices without re-creating the
  graph wiring the tool doesn't expose. Its live param paths are offline-baked envelopes
  (`--automate-parameter … --automation-pattern step-editing`, authored as Song.abl
  `envelopes`) or a 2-state `--tweak-parameter`/`--alt-preset` toggle — never an arbitrary
  external value stream. **EnginePerfTool stays an offline renderer.**

(`MoveLibBenchmark`, the other 28 MB engine binary, embeds the same engine but is a
firmware/SWUpdate benchmark — its only "exports" are statically-linked zlib; nothing more
to offer than EnginePerfTool.)

### Live expression via injection: poly-AT YES, CC74/bend NO (EMPIRICALLY TESTED 2026-06-06)
The static RE hinted per-note CC74/bend reach voices (`mMidiPerNoteCC74`, `mMidiPerNotePitchBend`,
`PerNotePitchBendUtils.cpp`, `RampedPerNoteControlChange`). **On-device measurement refuted that
for cable-2 channel injection and confirmed poly-AT instead.** Method: `engine-probe` held a note
and stepped one controller 0↔127 every 0.743 s; Move's output was captured over **USB audio**
("Ableton Move Audio", recordable via ffmpeg once Move is USB-C connected) and analysed (pitch via
autocorrelation, brightness via spectral centroid, level via RMS):
- **Pitch bend → flat.** Static saw held at 261.6 Hz, wander ±0.07 semitone, no 0.743 s structure.
- **CC74 → flat.** Centroid steady; **MIDI CC is unsupported by design** (manual §4.1.3).
- **Channel aftertouch → flat.**
- **Poly aftertouch → CONFIRMED.** On a pressure-mapped Drift preset, voice **volume swung 16 dB
  (5.6×)** in strictly alternating loud/quiet blocks of ~0.70 s — locked to the probe's 0.743 s
  flip (run-length + matched-filter). Notes/velocity always work.

Why: the engine's per-note CC/bend path is fed by **Move's own pads via the internal control
protocol**, not by cable-2 channel MIDI; and CC/mono-AT/MIDI-mapping are unsupported on the MIDI
input by design. So the live real-engine palette via injection is **notes + velocity + poly-AT**
(poly-AT only on Drift/Wavetable presets that map pressure). Not tested: true MPE
(one-note-per-channel) — but poly-AT already gives per-note pressure, the main expressive axis.

### Live device-parameter automation (p-locks) — CONFIRMED via cable-0 encoder CC (2026-06-06)
**The frontier is cracked, and it was simpler than feared.** Device/engine parameters can be
driven live by **injecting an encoder Control Change on cable 0** (the hardware control-surface
slot), NOT via track CC and NOT via the `onSysExInput` SysEx path. On-device proof: `engine-probe`
Mode B injected **CC 71 (knob 1), cable 0, delta-encoded** (+2/−2 ramps); with Move showing a Drift
**device page**, the on-screen **"Hi-Pass Freq" parameter swept up and down on its own**, hands-off,
locked to the probe's ramp. The displayed value *is* `ParameterControllerNode::SetManualValue` — the
same value the DSP reads — so the engine parameter is genuinely moving. This is **live p-locks on
Ableton's real engine via injection.**

Mechanism (matches the RE): encoders ride **ordinary MIDI CC** on cable 0, decoded by the view-tree
`MidiSurface` → `Encoder<…EncoderProtocol…>` → `makeParameterView<…, GetMappedParameter>` →
`ParameterDelegate::MappedParameter` → `SetManualValue`. (The `onSysExInput` 4-byte path is XMOS
telemetry — a dead end; we did **not** need it.) Move's knobs are **relative/endless**: CC value
1..63 = +N, 65..127 = −(128−value); the probe sends +2 (`0x02`) / −2 (`0x7E`) ticks.

**Constraints (real but workable):**
- **Addressing is positional, not by parameter id.** Injecting CC 71..78 moves *whatever the current
  device view maps to knob 1..8 right now*. To automate a specific parameter you must first navigate
  Move so that parameter sits on a knob, then inject that knob's CC. A groovebox would script
  page-selection + the knob CC.
- Cable **0** (hardware control surface), channel 0 worked first try. (Probe can also try cable 2 /
  knobs 71–78.)
- The defer guard pauses injection while real hardware events are in MIDI_IN, so hands-off while it
  runs.

**Net:** live real-engine control via injection is now **notes + velocity + poly-AT expression +
device-parameter automation (p-locks)** — far more than "notes only." Macros (which are themselves
parameters on a knob) should work the same way. Still out: arbitrary param addressing without view
navigation, and MIDI CC routed to a *track* (unsupported by design).

### Test harness
Both live experiments are bundled in one dev tool:
`schwung/src/modules/tools/engine-probe/` (a sibling of `seq-test`). It injects via
the existing `midi_inject_to_move` path (the drain preserves the caller's cable nibble —
`shadow_midi.c:613`, so it can place **cable-0** encoder CCs as well as **cable-2** notes):
- **Mode A (per-note expression):** holds C4 on a track channel and sweeps CC74 / pitch-bend /
  poly-AT / channel-AT (cable 2) — listen for live voice modulation.
- **Mode B (encoder→param):** injects a delta-encoded knob CC (71–78) on cable 0; press Back
  (suspend_keeps_js keeps it running) and open Move's device page — watch the mapped parameter
  travel = live p-lock on the real engine.
- **Mode C (sysex ping):** fires `F0 7D 01 F7`; confirm it only logs (`onSysExInput` = telemetry).

Build (Docker cross): `aarch64-linux-gnu-gcc -O2 -shared -fPIC -Isrc
src/modules/tools/engine-probe/dsp/engine-probe.c -o build/modules/tools/engine-probe/dsp.so -lm`
(verified → valid aarch64 `.so` exporting `move_plugin_init_v2`). Package as a module tarball
(`engine-probe/{module.json,ui.js,dsp.so}` at top level) and deploy with the supported installer —
`./scripts/install.sh install-module ./build/engine-probe-module.tar.gz` (root-extracts into
`modules/tools/` + chowns `ableton:users`; **don't** loose-scp individual files). **Back up `/data` first.**

### Updated capability summary (✓ = measured on device via USB-audio capture)
| Live on real engines via cable-2 injection | Status |
|---|---|
| Notes / velocity | ✅ proven (note sounds at exact pitch) |
| **Polyphonic aftertouch** | ✅ **MEASURED** — 16 dB voice modulation locked to test square; Drift/Wavetable pressure-mapped presets only |
| Pitch bend | ❌ **measured flat** (±0.07 semitone on a static saw) |
| CC74 / any MIDI CC | ❌ **measured flat** — unsupported by design (manual §4.1.3) |
| Channel (mono) aftertouch | ❌ unsupported (manual) |
| **Device-parameter automation (p-locks) via cable-0 encoder CC** | ✅ **MEASURED** — knob-CC (cable 0, delta) swept "Hi-Pass Freq" on a Drift device page, hands-off; positional addressing (knob 1–8 = current view's mapping) |
| Device params via track CC / `onSysExInput` SysEx | ❌ track CC unsupported; SysEx path is telemetry (dead end) |
| EnginePerfTool/MoveLibBenchmark as a persistent live host | ❌ bounded runtime + dormant input node |
