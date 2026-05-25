# Pad pressure (aftertouch) — design

**Date:** 2026-05-25
**Branch:** `pad-pressure`
**Status:** Phase 1 implemented + **device-verified 2026-05-25** (Move responds to poly AT
from dAVEBOx pads; external synths respond to poly + channel AT; Schwung assumed fine —
no chain synths support channel AT yet). Phase 2 specified, not built.

## Goal

Make Move pad pressure expressive. The Move pads emit per-pad **poly aftertouch**
(`0xA0`, pad note in `d1`, value 0–127 in `d2`) — confirmed by device probe (221
messages, full range, zero channel AT). Two user-facing wants:

1. **Drum repeats respond to pressure** (already coded, was dead) — *fixed, verified*.
2. **Melodic pads send aftertouch** to the sound engine, switchable per-track, and
   **recordable into clips** (no per-event editing; just a future "clear all AT on a
   clip" gesture).

## Background: what already exists

- **Drum-repeat pressure** (`ui.js` `_onPadAftertouch`): holding a repeat pad and
  pressing harder sets incoming repeat velocity (Rpt1 + Rpt2). Was unreachable because
  `isNoiseMessage()` (shared `input_filter.mjs`) classifies all `0xA0`/`0xD0` as noise
  and the handler ran it on line 1 of `_onMidiInternalImpl`. **Fix (shipped on this
  branch):** handle `0xA0` *before* `isNoiseMessage`, route to `_onPadAftertouch`,
  return. The shared filter is untouched (it's Schwung-fork-wide; channel AT stays
  classified as noise by default there).
- **CC automation** already records/plays back **channel-pressure** aftertouch per-clip
  — but it is **knob-driven and mono** (`cc_type[k]==1` → `0xD0`, one lane). It does
  **not** cover pad-driven or **poly** (`0xA0`) aftertouch. Pad-pressure recording needs
  its own data path (Phase 2).
- **Output routing** is unified in DSP `pfx_send` → `pfx_emit` (`seq8.c:1970`/`2111`):
  routes **any** status by `fx->route` — ROUTE_MOVE → `midi_inject_to_move` (cable 2,
  CIN from `status>>4`), ROUTE_EXTERNAL → `midi_send_external`, ROUTE_SCHWUNG →
  internal. Arp/looper/merge/swing hooks only intercept note on/off; AT passes through.
  `cc_emit` (`seq8.c:5980`) already sends `0xD0|ch` via this path.
- **Held-pad pitch** is already tracked: `padPitch[padIdx]` is set to the sounded pitch
  at melodic press (`ui.js:8555`) and cleared to `-1` on release. Poly AT reads it
  directly — no new tracking needed, and it captures the pitch *as heard* (immune to
  mid-hold octave/scale shifts).

## Per-track setting (both phases)

New per-track **"AftTch"** enum in the track menu (`buildGlobalMenuItems`, near
VelIn/Looper). **Shown on melodic tracks only** — on drum tracks pad pressure is owned
by the repeat-velocity system, so the item is hidden (spread-conditional on
`trackPadMode !== DRUM`). Options depend on the track's route (menu rebuilds on open):

- **ROUTE_MOVE**: `Off / Poly` (Move instruments support poly AT — user-confirmed).
- **ROUTE_SCHWUNG, ROUTE_EXTERNAL**: `Off / Poly / Channel`.

State: `S.trackAtMode[t]` (0=Off, 1=Poly, 2=Channel), default **Off**. Persisted in the
UI sidecar as `am` (array), gated on sidecar `v >= 9` (writer bumped 8→9; reader
tolerant — old sidecars default Off). No DSP state version bump. **Default Off means
every new code path is dormant unless the user opts in** — the safety property that makes
blind deployment acceptable.

## Phase 1 — live send (IMPLEMENTED on this branch)

When a melodic pad's poly AT arrives and the track's AftTch mode is non-Off:

1. `_onPadAftertouch(d1, d2)` (melodic branch): `padIdx = d1 - TRACK_PAD_BASE`;
   `pitch = padPitch[padIdx]`. If `pitch < 0` (no live note on that pad) → ignore.
2. Dedupe: skip if pressure equals the last value sent for that pad (`S.atLastSent`).
3. Send one DSP `tN_live_at` set_param: `"<pitch> <pressure> <mode>"`.

**DSP `tN_live_at` handler** (`seq8_set_param.c`, beside `live_notes`): stateless,
~10 lines.

```c
if (!strcmp(sub, "live_at")) {
    int pitch = 0, press = 0, mode = 1;
    sscanf(val, "%d %d %d", &pitch, &press, &mode);
    uint8_t ch = tr->channel & 0x0F;
    if (mode == 2) pfx_send(&tr->pfx, (uint8_t)(0xD0 | ch), (uint8_t)clamp_i(press,0,127), 0);
    else           pfx_send(&tr->pfx, (uint8_t)(0xA0 | ch),
                            (uint8_t)clamp_i(pitch,0,127), (uint8_t)clamp_i(press,0,127));
    return;
}
```

This reuses the proven `pfx_send` output path, so all three routes work uniformly
(ROUTE_MOVE inject / external / Schwung internal) and AT reaches the instrument exactly
as the sequencer's own notes do. (Chosen over the advisor's "reuse `liveSendNote` JS
pass-through for Schwung+external": that path's ROUTE_MOVE AT branch is the
note-queue-corruption path, and routing all three through one stateless DSP handler is
simpler and more reliably reaches the instrument blind.)

**Known v1 limitation:** `tN_live_at` is one per-track key → host per-buffer coalescing
keeps only the last value per audio buffer. For a **single** held note (the common case)
this is correct — we only want the latest pressure. For **multiple** simultaneously held
pads, per-pad poly pressure collapses to one pad per buffer. Documented; a batched
payload (Phase 2-style) would lift it if needed.

**Channel mode** collapses to one value (latest pad's pressure) by design — channel
pressure is track-wide.

## Phase 2 — record / playback / clear (SPEC ONLY — build with device)

Not built blind: it adds a per-clip data structure, a new state-serialization path, and
audio-thread playback emission; each needs a verify-fix loop on-device. Default-Off
gating keeps the hot path dormant, but does not make the *correctness* loop verifiable
without the device.

### Data model

Per-clip AT event log, mirroring the note text format (`tick:pitch:val;`):

- Poly: `pitch` = note number (0–127). Channel: `pitch` = `255` (track-wide sentinel).
- Stored sorted by tick. Per-clip cap **`AT_MAX_EVENTS = 2048`** (matches note scale).
- **Decimation at capture** (keeps the log small and the state buffer safe):
  1. drop if `|val − lastVal(forThisPitch)| < 2`;
  2. drop if same tick + same pitch already written (last-wins);
  3. min inter-event spacing 1 tick per pitch.
  At incoming ~15 Hz, decimation yields well under the cap for multi-bar clips.

### Recording

When transport playing + record-armed + AftTch non-Off: capture incoming pad pressure
into the active clip's AT log at the current playhead tick (loop-window relative), with
decimation. Reuses the existing record-arm gate.

### Playback

In the per-track playback step (where notes/CC emit), scan AT events in the current tick
window and emit via `pfx_send` (same routing as live). Emit-on-change (mirror
`cc_auto_last_sent`; reset on transport play). Loop-window aware (wrap like notes/CC).

### Clear

`tN_cC_at_clear` handler wipes a clip's AT log + marks `state_dirty`. **Gesture: TBD**
(user to design; e.g. Delete + a dedicated control). Wired into Clear Session and
hard-reset-clip paths.

### State / persistence

New sparse per-clip key (e.g. `t%dc%d_at`) serialized as text — no state version bump
(text format tolerates growth). **Budget risk:** AT events add to the 64 KB `state_buf`;
the cap + decimation must keep total clip state under budget (overflow falls back to a
slow synchronous write). Verify with a worst-case full-pressure clip on-device.

### Open questions for the user (resolve before building Phase 2)

1. **Count-in capture** — should pressure during count-in be captured (like preroll
   notes) or ignored until recording proper starts?
2. **Scene-bake** — does baking a scene carry its AT data, or is AT live/recorded-only
   (excluded from bake)?
3. **Ableton export** — should the `.ablbundle` export emit recorded AT into the MIDI
   clips, or skip it for v1?
4. **Mode-switch with recorded data** — if a clip recorded Poly AT and the user switches
   AftTch to Channel (or Off), what happens to the recorded poly data on playback —
   collapse to channel, mute, or keep as-is?
5. **Cap/decimation numbers** — confirm `AT_MAX_EVENTS = 2048` and the `|Δ| ≥ 2`
   threshold feel right after device testing.

## Files

**Phase 1 (this branch):**
- `ui/ui.js` — `0xA0` early-handle before `isNoiseMessage` (drum-repeat fix, done);
  `_onPadAftertouch` melodic branch + `tN_live_at` send + dedupe; track-menu "AftTch"
  enum (route-dependent options).
- `ui/ui_state.mjs` — `S.trackAtMode[]` (default 0), `S.atLastSent[]` (per-pad dedupe).
- `ui/ui_persistence.mjs` — sidecar writer `am` field, bump `v` 8→9.
- `ui/ui.js` `restoreUiSidecar` — read `am` gated on `v >= 9`.
- `dsp/seq8_set_param.c` — `tN_live_at` handler.
- `MANUAL.md` — track menu AftTch row; `notes/CHANGELOG.md` `### Features`.

**Phase 2 (later):** `dsp/seq8.c` (AT log struct, serialize/load, playback emit,
clear/reset), `dsp/seq8_set_param.c` (record capture, `tN_cC_at_clear`), `ui/ui.js`
(record path, clear gesture, persistence hooks).

## Build / deploy / verify

Phase 1 is JS + DSP → `./scripts/build.sh && ./scripts/install.sh`; `nm -D
dist/davebox/dsp.so | grep GLIBC` ≤ 2.35; reboot Move. No state wipe.

**Verification (on device, plain hands-on) — pending user (away during build):**
1. **Drum repeats** (already confirmed ✅): drum track → Rpt1 → hold pad, vary pressure →
   repeat velocity follows.
2. **Move synth poly AT** (untested — Move-poly-AT assumed per user): melodic track,
   Route = Move, AftTch = Poly → play a note and lean in → the Move instrument responds
   to pressure.
3. **Schwung chain**: Route = Schwung, AftTch = Poly/Channel → pressure reaches the chain
   instrument.
4. **External**: Route = External, AftTch = Poly/Channel → AT goes out USB.
5. **Off = silent**: AftTch = Off → no AT sent (default; existing behavior unchanged).
6. **Menu options**: on a Move track the AftTch item shows Off/Poly only; on Schwung/Ext
   shows Off/Poly/Channel.
7. **Persistence**: set AftTch per track, save/reload set → restored.
