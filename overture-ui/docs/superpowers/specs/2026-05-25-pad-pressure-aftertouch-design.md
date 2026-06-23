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

## Phase 2 — record / playback / clear — **interpolation model**

Building with the user at the device (iterative verify per increment). Default-Off gating
keeps the hot path dormant; correctness verified on-device per increment.

**Model: interpolated breakpoints (CC-automation analog), keyed by pitch.** Chosen over a
flat event log (user request 2026-05-25): far smaller state footprint (the 64 KB DSP
`state_buf` is the real constraint, not Move disk), reuses the proven `cc_auto` machinery,
and unifies with CC automation for the Phase 3 bake/export work. CPU is a wash.

### Data model (`dsp/seq8.c`, on the track struct beside `clip_cc_auto`)

`cc_auto` has 8 *fixed* lanes (one per knob); poly AT needs a lane **per held pitch**
(dynamic). So a parallel struct with pitch-keyed lanes:

```c
#define AT_MAX_LANES   12     /* max distinct AT pitches per clip (poly); channel uses 1 */
#define AT_MAX_POINTS  512    /* breakpoints per lane (1/32-snapped → 16 bars) */
typedef struct {
    uint8_t  pitch[AT_MAX_LANES];                 /* 0-127 poly note; 255 = channel; 254 = free */
    uint16_t count[AT_MAX_LANES];
    uint16_t ticks[AT_MAX_LANES][AT_MAX_POINTS];  /* sorted, clip-tick */
    uint8_t  vals [AT_MAX_LANES][AT_MAX_POINTS];
} at_auto_t;   /* ~18 KB/clip → clip_at_auto[NUM_CLIPS] per track ≈ 2.3 MB total */
```

Helpers mirror cc_auto: `at_auto_reset`, `at_auto_find_lane(pitch)` /
`at_auto_alloc_lane(pitch)`, `at_auto_set_point(lane, tick, val)` (insert/update sorted),
`at_auto_eval(lane, tick)` (linear interpolate + hold at edges). `254` = free slot;
allocation fails gracefully past `AT_MAX_LANES` (drops the least-recently-used or simply
ignores new pitches — v1: ignore, log once).

### Recording (in the `tN_live_at` DSP handler — already has `tr`, pitch, press, mode)

When `tr->recording && pad_mode == MELODIC` and mode non-Off: snap to 1/32
(`(current_clip_tick/12)*12`, matching CC), find/alloc the lane (poly → by pitch; channel
→ the `255` lane), `at_auto_set_point`. Density is grid-limited (one point per 1/32 per
lane) like CC — no separate decimation pass needed; the user accepted the resulting size.
Live send still happens first (so it's monitored during count-in; capture is gated on
`recording`, which is false during count-in).

### Playback (render tick path, beside the CC-automation emit)

Each tick, for every allocated lane: `at_auto_eval` at the playhead clip-tick, emit on
change via `pfx_send` (`0xA0|ch,pitch,v` poly / `0xD0|ch,v` channel). Per-lane
`last_sent[AT_MAX_LANES]` (0xFF = force); reset on transport play. Loop-window aware (eval
uses the same wrapped clip-tick as notes/CC). **Independent of the AftTch toggle** —
recorded AT always plays (decision #2).

### Clear — the AUTOMATION bank (decided 2026-05-25)

The CC PARAM bank (bank 6) is generalized into the **AUTOMATION** bank — a home for all
per-clip continuous-modulation data (CC now, AT now, PB later).

- **Header rename:** `CC AUTOMATION` → `AUTOMATION` (`ui_constants.mjs` `BANKS[6].name`).
- **Type indicators:** in the bank's OLED header, show inverted badges (white bg / black
  text) for each automation type **that has data in the focused clip** — `AT`, `CC` (and
  `PB` once implemented). A type with no data shows **nothing**. Needs a per-clip "has
  data" signal per type: CC = any knob has automation (`trackCCAutoBits`) or a rest value
  (`clipCCVal`); AT = new get_param `tN_cC_at_has` (→ `at_auto_has_data`); PB = always
  false for now.
- **Delete tap** (press+release with no jog/knob/step in between) → **CLEAR AUTOMATION**
  modal: jog scrolls, jog-click toggles a checkmark per type, a **CLEAR** row executes the
  checked types, Back/Note cancels. **PB row is shown dimmed/disabled** (placeholder).
  Existing Delete+knob-touch (per-knob CC clear) and Delete+step (per-step CC clear)
  **stay**. CC clear = all CC data (the existing `cc_auto_clear`); AT clear =
  `tN_cC_at_clear`.
- **Bank reset = clear ALL automation:** both **Delete+jog** (bank-6 reset) and
  **Shift+Delete+jog** (broad melodic FX reset) now also clear AT (and PB when it exists),
  not just CC.
- `tN_cC_at_clear` handler (done) + AT auto-clear at every clip-wipe site (Clear Session,
  clip/row cut+copy, hard-reset) — done. Note-only clears leave AT intact.

### State / persistence

Per-clip serialization of allocated lanes only (sparse). Format per lane:
`p<pitch>:<t0>,<v0>;<t1>,<v1>;…` under a per-clip key (e.g. `t%dc%d_at`), emitted only for
clips with ≥1 lane. **No state version bump** (stays v=32) — additive text keys, exactly
like the CC `rest_val` addition: old state loads with AT empty, new state's AT keys are
ignored by an old binary. No wipe. Interpolated breakpoints keep this well under the
64 KB `state_buf`; still spot-check a worst-case full-pressure clip on-device.

### Resolved decisions (2026-05-25)

1. **Auto-record.** Pressure is captured automatically whenever a melodic track is
   record-armed and its AftTch mode is non-Off. No separate AT-arm.
2. **The AftTch toggle governs incoming only** (live send + recording). **Recorded AT
   always plays back as stored, independent of the toggle** — Off stops *new* AT from
   being sent/recorded but does not mute already-recorded AT. Each stored event therefore
   encodes its form (poly carries its pitch; channel is the `255` sentinel) so playback
   replays faithfully regardless of the current mode. Removing recorded AT is the clear
   gesture's job, not the toggle's.
3. **Count-in: monitored, not recorded.** Live AT keeps sounding through the count-in
   (the live-send path isn't gated on recording state); capture is gated to start only
   when recording proper begins (post-count-in), like notes.
4. **Bake / export / live-merge: capture AT *and* CC automation — deferred to Phase 3.**
   The user wants recorded pressure *and* CC automation baked into Capture/bake,
   Export-to-Ableton, and Live-Merge output. This is a cross-cutting follow-up (three
   subsystems; CC-in-bake is itself new) and is intentionally **out of this Phase 2 build**
   to keep first-time AT playback verifiable in isolation.
5. **Cap/decimation:** `AT_MAX_EVENTS = 2048`/clip, decimate at capture (`|Δ| < 2` skip,
   one point per pitch per tick). Confirmed; tune after device testing.

### Build increments (Phase 2, device-verified each step)

- **2a — storage:** per-clip AT event array on the clip struct + text serialize/load +
  `clip_init`/clear defaults. Self-verify (ssh state file, no crash).
- **2b — record:** capture incoming pad AT into the active clip when armed + AftTch
  non-Off + playing + not count-in, with decimation. (Built with 2c — record needs a
  consumer to be user-testable.)
- **2c — playback:** emit stored AT in the playhead tick window via `pfx_send`,
  emit-on-change, loop-window aware. **First user-verifiable unit** (record a press →
  hear it on the next loop).
- **2d — clear:** `tN_cC_at_clear` handler wiping a clip's AT log + Clear-Session /
  hard-reset-clip hooks; user-facing **gesture TBD** (design with user).

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
