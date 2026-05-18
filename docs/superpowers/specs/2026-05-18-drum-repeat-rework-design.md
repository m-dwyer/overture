# Drum repeats — count-in, Repeat Sync, record-at-rate

**Date:** 2026-05-18
**Status:** Approved approach; awaiting spec review
**Parked items resolved:** `drum-repeats-during-countin`, `drum-repeat-inq-behavior` (both items)
**Branch:** `1.0-tweaks` (third fix in the batch)

## Problem

Three pre-existing behaviors around drum repeats are deliberately conservative or partial today:

1. **No drum repeats during count-in.** Holding a Rpt1 / Rpt2 pad through the 1-bar count-in produces silence. Once recording fires, repeats start — but the user can't hear what they're about to commit to. Inconsistent with ARP IN, which Bundle 1.6 wired into the count-in inner-while loop for the same reason.
2. **First-repeat-fire timing is owned by InQ, not by an engine-local clock decision.** Today the first repeat-fire snaps to the next InQ boundary when InQ is on and transport is playing. When transport is stopped, it ignores InQ entirely and fires instantly. Two different behaviors keyed off the wrong concept — InQ is fundamentally about quantizing live input/recording, not about clocking the engine.
3. **Repeats collapse to step boundaries when InQ is on.** A 1/32-rate repeat played against a 1/16-step grid with InQ on records every fire at offset 0 of the nearest step — losing the sub-step half of the pattern. The clip plays back as a 1/16 cadence even though you heard a 1/32 cadence. Stacking is also forbidden in this mode, compounding the loss.

## Goal

- Repeats run through count-in audibly, then seamlessly into recording.
- First-fire snap is a separate concern from InQ — controlled by a new per-track `SyncRpt` toggle, defaulted ON.
- When recording with the engine running, every fire writes its actual sub-step offset into the clip. Playback fidelity = audible fidelity.

## Non-goals

- Looper ticking during count-in — explicit no. Looper is a clip-loop recorder; running during pre-record would capture warm-up presses.
- SEQ ARP ticking during count-in — also no. Playback-side engine, no clip playback during count-in.
- Changing InQ for live (non-repeat) pad presses or step-record paths. Only the drum-repeat recording paths inside `drum_repeat_tick` / `drum_repeat2_tick` lose the `off = 0` collapse.

## Architecture

Three coordinated changes in `dsp/seq8.c`, plus one knob-slot addition in `ui/ui_constants.mjs` + a JS bank-row binding.

### Sub-feature 1: Count-in drum repeats

**Site:** `seq8.c:6920-6923` (count-in inner-while loop, currently calls `tarp_tick` per track and increments `arp_master_tick++`).

**Change:**
- Add `drum_repeat_tick(inst, &inst->tracks[_tt])` and `drum_repeat2_tick(inst, &inst->tracks[_tt])` to the same per-track loop alongside `tarp_tick`.
- Comment at L6916-6919 ("only TARP, not looper/drum-repeats/SEQ-ARP") updates to: "TARP + drum repeats; looper + SEQ ARP stay dormant (playback-side)."

**Count-in fire reset (seq8.c:6926+):** Mirror TARP's runtime reset (currently at L6962-6970) for each drum track:
- For Rpt1: if `drum_repeat_active`, reset `drum_repeat_phase = 0`, `drum_repeat_step = 0`, `drum_repeat_pending = 0` (Repeat Sync will re-evaluate against the new `arp_master_tick=0`).
- For Rpt2: for each bit set in `drum_repeat2_active | drum_repeat2_pending`, reset `drum_repeat2_phase[l] = 0`, `drum_repeat2_step[l] = 0`. Move pending bits into active (transport-start = grid-aligned).
- Drain `play_pending[]` entries whose lane is one of the drum lanes — set `ticks_remaining = 0` so the next tick's note-off pass at `seq8.c:7028-7041` fires them immediately. Mirrors the pfx-event reschedule at L6952-6957.

### Sub-feature 2: Repeat Sync toggle

**New per-track field:** `seq8_track_t.drum_repeat_sync` (uint8_t, 0 or 1). Default 1.

**State storage:** persisted in DSP state. Bump `v=27 → v=28`. Pre-public posture: old saves rejected on load, clean start. Matches the convention from every prior DSP state bump.

**New set_param handler:** `tN_drum_repeat_sync` with values "0" / "1". Calls into `seq8_set_param.c` next to the other Rpt control keys.

**New get_param handler:** `tN_drum_repeat_sync` for JS state mirroring.

**JS bank binding:** Bank 7 (ALL LANES) gets a new entry at K6 in `ui_constants.mjs:308-315`:

```js
p('SyncRpt', 'Repeat Sync', 'drum_repeat_sync', 'track', 0, 1, 1, fmtBool, 16),
```

Position: K6 (currently `_X`). Label is 7 chars and intentionally spills into K7's empty column when knob is idle (white-on-black, fully visible). When K6 is touched, the 24×24 highlight only fits 4 chars, so the label visually truncates to "Sync" inside the highlight — user-accepted trade-off; the user knows what they touched.

**DSP behavior change:**

In `drum_repeat_start_internal` (seq8.c:3815-3840):
- Replace the `inst->playing` gate with the new `tr->drum_repeat_sync` gate.
- Replace the phase math `inst->global_tick * TICKS_PER_STEP + inst->master_tick_in_step` with `inst->arp_master_tick`. `arp_master_tick` is PPQN-cadence and free-runs across stopped/playing/count-in, resetting at transport play and count-in fire — exactly the clock semantics we want.
- Replace the InQ-grid math with the rate grid. Rounding semantic: **strict next, not round-to-nearest.** The existing code at L3835 (`phase >= qt / 2 ? 1 : 0`) deliberately rounded to nearest to keep first-fire latency tolerable. Do NOT carry that compromise forward — the new rule is: if `arp_master_tick % rate_ticks == 0` exactly, fire now (pending=0); otherwise pending=1 and wait for the next tick where the modulo is 0. Worst-case latency = one full rate interval. User explicitly chose this over round-to-nearest for predictability.

In `drum_repeat2_lane_on_internal` (seq8.c:3880-3907): same swap (drum_repeat_sync gate, arp_master_tick clock, per-lane rate_ticks grid).

In `drum_repeat_tick` (seq8.c:3952-3962, the pending-resolve block): swap the InQ-grid check to `arp_master_tick % rate_ticks == 0` test. Same in `drum_repeat2_tick` (seq8.c:4080-4101).

**Sync flag persistence:** Pad-press transitions and rate changes do NOT clear `drum_repeat_sync` — it's a per-track user preference, only mutated by the user touching K6 in the ALL LANES bank.

### Sub-feature 3: Record at repeat rate

**Sites:** `drum_repeat_tick` recording block at seq8.c:4001-4034 (Rpt1) and `drum_repeat2_tick` recording block at seq8.c:4131-4163 (Rpt2).

**Two lines change per engine:**

```c
if (inq_on) off = 0;                              // DELETE
```

and

```c
} else if (!inq_on) {                             // change to:
} else {
    can_write = (rlc->step_note_count[rs] < 8);
}
```

Net effect: `off` keeps its actual sub-step value (after the existing midpoint rule rounds `off >= TICKS_PER_STEP/2` cases into the next step). Stacking up to 8 notes per step is permitted regardless of InQ.

**Reader compatibility:** `clip_build_steps_from_notes` and `note_step()` already round via `(tick + tps/2) / tps`. The midpoint-rule writer matches the reader exactly — `dsp/CLAUDE.md`'s "Step-write invariant" already enforces this. Sub-step offsets play back correctly without any reader changes.

## Risk

- **DSP state version bump 27 → 28.** Per pre-public posture, every prior bump deleted old user data on first boot of the new build. Same expected behavior here. User has confirmed this is acceptable for every prior bump.
- **Existing clips with InQ-collapsed Rpt recordings stay as they were.** They were recorded under the old rule and will play back per the data stored. Only new recordings benefit from sub-step fidelity. No migration.
- **Repeat Sync defaults to ON.** Users used to "instant fire while stopped" will now experience up to one repeat-rate-interval of pre-fire latency. The toggle is in a discoverable place (ALL LANES bank K6), and the long name "Repeat Sync" is shown on the OLED help row when touched. Defaulting OFF was an option but you chose ON — most users will find grid-aligned starts cleaner once they hit Play.
- **Spilled "SyncRpt" label truncates to "Sync" when touched.** Surfaced in the UI question. Accepted trade-off; user knows what they touched.
- **Count-in fire reset includes draining `play_pending[]` for drum lanes.** Different from TARP's pfx-event reschedule (which sets `fire_at = 0`); drum repeats use `play_pending[]` with `ticks_remaining` counters. The drain is consistent with how the existing stopped-state path at L7028-7041 fires off note-offs once `ticks_remaining == 0` — we just force the count by writing 0.

## Testing matrix (verify on Move at end of `1.0-tweaks` batch)

| # | Setup | Action | Expected |
|---|---|---|---|
| 1 | Drum track, Rpt1 armed at 1/16, transport stopped, hit Record (count-in begins) | Hold a drum pad through count-in | Repeats audible during count-in; first repeat post-fire lands at step 0 of loop window. |
| 2 | Same, Rpt2 latched on one lane | Hold + lane stays latched through count-in | Latched lane repeats audible through count-in; fires through into recording without a phase glitch. |
| 3 | Looper armed, count-in active | (Don't press anything) | Looper does NOT engage during count-in. Behaves identically to today. |
| 4 | Stopped, SyncRpt ON (default), Rpt1 at 1/32 | Tap and hold a pad | First fire waits until next rate-grid boundary (≤12 ticks), then steady 1/32 cadence. |
| 5 | Same, SyncRpt OFF | Tap and hold a pad | First fire immediate (matches old stopped-state behavior). |
| 6 | Playing, SyncRpt ON, Rpt1 at 1/16, InQ at 1/8 | Press a pad mid-step | First fire at next 1/16 boundary (rate grid), NOT next 1/8 boundary. Distinct from old behavior. |
| 7 | Playing, SyncRpt ON, two pads at same rate, different lanes (Rpt2) | Press lane A, then lane B a moment later | Both phase-locked to the same rate grid. |
| 8 | Recording, Rpt1 at 1/32, InQ ON at 1/16, hold a snare pad for one bar | Press Record after | Step-edit view shows fires across adjacent steps (sub-step offsets preserved). Playback at true 1/32 cadence. |
| 9 | Same as #8 but Rpt2 | Same | Same outcome. |
| 10 | SyncRpt knob — touch K6 in ALL LANES bank | Observe OLED | Idle: label reads "SyncRpt" (spills into K7 column). Touched: label collapses to "Sync" inside highlight. Value flips 0/1. |
| 11 | State persistence — set SyncRpt to OFF on track 3, Shift+Back to save, reboot Move | Re-enter dAVEBOx | Track 3 SyncRpt still OFF; other tracks still ON. |

## Implementation steps

1. Already on `1.0-tweaks`. No new branch.
2. **DSP (`dsp/seq8.c` + `dsp/seq8_set_param.c`):**
   - Add `uint8_t drum_repeat_sync` to `seq8_track_t`. Default 1 in `create_instance`.
   - Add `tN_drum_repeat_sync` set_param + get_param handlers in `seq8_set_param.c`.
   - Add state save/load for `drum_repeat_sync` (key prefix e.g. `t%d_dsy`). Bump DSP state `v=27 → v=28`.
   - Sub-feature 1 (count-in): Update inner-while loop at seq8.c:6920-6923 and reset block at L6926+.
   - Sub-feature 2 (Repeat Sync): Update `drum_repeat_start_internal`, `drum_repeat2_lane_on_internal`, `drum_repeat_tick` pending-resolve, `drum_repeat2_tick` pending-resolve.
   - Sub-feature 3 (record at rate): Delete `if (inq_on) off = 0;` and update stacking gates in both ticks.
3. **JS (`ui/ui_constants.mjs`):**
   - Add `p('SyncRpt', 'Repeat Sync', 'drum_repeat_sync', 'track', 0, 1, 1, fmtBool, 16)` at bank 7 K6.
4. **JS (`ui/ui.js`):**
   - No bank-handler changes — generic per-track bool binding handles set/get via `bankParams`.
   - Wipe-state path: `doClearSession()` already wipes DSP state; no JS-side mirror to zero.
5. **Build + deploy:**
   - `./scripts/build.sh && ./scripts/install.sh` (DSP changed → full rebuild).
   - Wipe device state files before deploy: `ssh root@move.local "find /data/UserData/schwung/set_state -name 'seq8-state.json' -exec rm {} \; && find /data/UserData/schwung/set_state -name 'seq8-ui-state.json' -exec rm {} \;"` per CLAUDE.md state-version-bump rule.
   - Reboot Move.
6. **CHANGELOG entry under `[Unreleased] → ### Features`** (it's a feature — new control surface + new behavior — not a fix).
7. **MANUAL.md updates:**
   - Bank 7 (ALL LANES) knob list: document K6 as SyncRpt / Repeat Sync.
   - Behavior section for Rpt1 / Rpt2: explain how SyncRpt affects first-fire timing, and that repeats now run through count-in.
   - Recording section: note that InQ no longer collapses repeat fires to step boundaries.
8. **Verify on device at end of batch** with the 11-row testing matrix.
9. **Commit as `feat:` on 1.0-tweaks.**

## CHANGELOG entry (draft)

```
### Features
- **Drum repeats during count-in + first-fire Repeat Sync + true sub-step recording.** Holding a Rpt1 / Rpt2 pad through count-in now sounds the repeats audibly through the click, then fires seamlessly into the recorded clip at the loop window start — same warm-up affordance ARP IN already has. A new per-track Repeat Sync toggle (ALL LANES bank K6, default ON) replaces the old InQ-tied first-fire snap: when on, the first repeat-fire of a press waits for the next rate-grid boundary (anchored to a free-running clock that resets at transport play / count-in fire) regardless of whether transport is stopped or playing; when off, the first fire is instant. And when recording with InQ on, every repeat fire now writes its actual sub-step offset into the clip instead of collapsing to the step boundary — a 1/32 rate played against a 1/16 step grid records as a true 1/32 cadence with adjacent-step notes carrying their own offsets, exactly the timing you heard. DSP state bumped to v=28; user clips will reset on first boot of this build per the pre-public no-migration posture.
```

## Out of scope

- Looper count-in coverage (explicit no).
- SEQ ARP count-in coverage (explicit no — playback-side).
- Changing InQ for live (non-repeat) recording or step-edit paths.
- Visual indication that SyncRpt is on/off at a glance from outside the bank (no LED hint elsewhere). User can check by touching K6.
