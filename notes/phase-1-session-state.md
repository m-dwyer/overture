# Phase 1 — Session Checkpoint (Bundles 1 + 1.5 + 1.6 + 2.0 + 2A + 2B + 2C-Rpt1 + 2C-Rpt2 complete)

**Saved:** 2026-05-15 → 2026-05-16 (Bundles 1.5, 1.6) → 2026-05-17 (Bundles 2.0 + 2A + 2A-fixup + 2B shipped) → 2026-05-17 (Bundles 2C-Rpt1 + 2C-Rpt2 shipped, end of session).
**Status:** **✓ Sub-bundle 2C COMPLETE + VERIFIED + PUSHED on `phase-1-bundle-2`** (head = `3336e2b`). Branch sits on top of `phase-1-bundle-1` (Bundle 1 + 1.5 + 1.6, head = `2b319a2`, unchanged). User-verified end-to-end: Rpt1 rate-pad classifier on audio thread (2C-Rpt1), Rpt2 lane-pad + rate-pad classifier on audio thread incl. multi-lane engage/release/latch, Loop+hold latching paths, re-tap-to-unlatch at fastest rate, Delete+pad properly gated (no audio-thread engagement) — 2C-Rpt2. The last big sub-bundle of Phase 1 is done. Next: end-of-Phase-1 coordinated drop (fork main merge, dAVEBOx main merge, patch regen, cleanup pass, release). See "What's NOT done yet" below.

**Discipline locked-in for this refactor:** **NO main merges until the entire Phase 1 refactor is complete and verified end-to-end.** Bundle branches push to their own remote refs only; one coordinated mainline drop + patch regen + release at the very end. Stated 2026-05-16 — memory: `feedback_phase_1_no_main_until_done.md`.

---

## Commits on phase-1-bundle-1 (off main, pushed to `origin/phase-1-bundle-1`)

- `73295f0` drum mode — `computePadNoteMap` branches: drum tracks push lane `midi_notes`; right-half pads emit 0xFF (vel zones aren't note dispatch).
- `d3fb587` trackOctave — bake runtime octave shift into DSP padmap push; resync on Up/Down arrows + drumLanePage change.
- `f47c93e` session-view padmap gate + drum lane note repush.
- `2e540d9` single-buffer monitor when armed on patched Schwung — on_midi dispatches unconditionally; record-path inline-monitor gated on `!dsp_inbound_enabled`.
- `f822dfe` record-tick slot mechanism — `on_midi` snapshots actual hardware press/release tick on audio thread; record handlers read from per-(track,pitch) / per-(track,lane) slots.
- `b5c3fa7` docs: session-state checkpoint (mid-session).
- `a46bb3c` **Bundle 1.5** — count-in preroll capture (last 1/8 note window) + window-aware recording (drop `% clip_ticks` in record_note_on/off, drum_record_note_on/off, tarp_fire_step, finalize_pending_notes; widen drum bounds to `< loop_start + length`).
- `eaa0af9` **Bundle 1.6** — ARP IN during count-in: tick `tarp_tick` inside the count-in loop; sync=off preroll capture in `tarp_fire_step` (gate `count_in_ticks <= PPQN/2 && count_in_track == t && !tarp_sync`, snap_tick = `loop_start * tps`); count-in fire primes `current_clip_tick = loop_start * tps`, resets every TARP-on track's runtime (`master_anchor=0`, `pending_first_note=(held_count>0)`, `sounding_active=0`), and reschedules in-flight pfx events to `fire_at=0` so queued note-offs release voices cleanly without a broadcast panic.

(Earlier Bundle 1 commits `78f9275`, `000e30e`, `ac3c3c2` are the scaffold/initial-dispatch trio that landed before the session-state file was first written; they sit underneath these on the branch.)

## Commits on phase-1-bundle-2 (off phase-1-bundle-1, pushed to `origin/phase-1-bundle-2`)

- `ddd81da` **Bundle 2.0 + 2A** — pad-source scaffold + drum vel zones in on_midi. Adds `pad_source_t` enum + `inst->pad_source_scratch[NUM_TRACKS]` (2.0 publishes only NORMAL; 2B/2C add the bypass sources). Adds `drum_pad_event(track, padIdx, vel, isOn)` classifier wired into `on_midi` before the pitch lookup. NORMAL branch fires active-lane note at zone velocity + populates `on_midi_drum_press_*[t][active_lane]` slot for vel-pad recording (post-Bundle-1.5 preroll filter required slot=active). Rpt branches return "handled, don't dispatch" gated on a new `tr->drum_perform_mode` mirror (NOT on `drum_repeat_active`, which flips too late). Adds two volatile DSP per-track mirrors: `active_drum_lane` (8 JS sites → `setActiveDrumLane` helper) and `drum_perform_mode` (2 JS sites → `setDrumPerformMode` helper). Both helpers use array-ref alias (`const arr = S.x; arr[t] = v`) to avoid replace_all self-recursion — see memory `feedback_replace_all_self_referential_helper.md` for the bug we hit on first deploy.
- `4b6fca9` **Bundle 2A fixup** — Rpt2 left-half lane pads also return "handled" from `drum_pad_event`. Rpt2 activation is left-half (JS pushes `tN_drum_repeat2_lane_on`; DSP's `drum_repeat2_tick` fires the first repeat); without skipping `on_midi` dispatch the first hit double-triggered. Rpt1's left-half pads still fall through to normal lane-note dispatch (no JS-side activation handler — single note is correct).
- `c4bd0fc` **Bundle 2B** — VelIn in on_midi via the existing `effective_vel(tr, raw)` helper, gated on `PAD_SRC_NORMAL` so vel-zone presses pass through untouched. Incidental free fix: TARP arp output now respects VelIn (it reads held-pad state populated by `live_note_on`; no `tarp_fire_step` change). JS `liveSendNote` VelIn block marked PHASE-1 (still runs on stock Schwung).
- `13ec307` **Bundle 2C-Rpt1** — Rpt1 rate-pad classifier moves to `drum_pad_event` on the audio thread. JS still owns the latch *decision* (Loop-held edge) but pushes an unconditional 0/1 edge on every rate-pad press; DSP `drum_repeat_latched` mirror lets `drum_pad_event` detect re-tap-to-unlatch synchronously. Drops the `pendingRepeatLane` JS-tick deferral hack. Two new internal helpers (`drum_repeat_start_internal`, `_stop_internal`, `_lane_internal`) extracted from set_param so both paths share code. PHASE-1 gates on JS pushes for `drum_repeat_start` / `drum_repeat_lane`.
- `3336e2b` **Bundle 2C-Rpt2** — Rpt2 lane-pad + rate-pad classifier moves to `drum_pad_event`. New mirrors: `tr->drum_lane_page` (JS pushes via `setDrumLanePage` helper), `tr->drum_repeat2_latched_lanes` (uint32_t bitmask), `inst->delete_held` (GLOBAL — see fan-out lesson below). Atomic `drum_repeat2_latch_held` set_param ORs active|pending into latched in one push, avoiding multi-lane coalescing. Audio-thread release handling closes the multi-lane simultaneous-release stranding bug. Internal helpers extracted; defensive latched-clear in `_on_internal` REMOVED so JS-pushed edges aren't stomped by host drain order. Runtime invariant checks added in `drum_repeat_tick` / `drum_repeat2_tick` (rate-limited warning if latched lacks active|pending backing). Header comments document the JS-authoritative lifecycle contract.

## Commits on `legsmechanical/schwung:phase-1-inbound` (off main, v0.9.13 base, pushed to `fork/phase-1-inbound`)

- `a58f557f` shim pad-delivery insertion (existed pre-session).
- `7aa0a0e9` capability sentinel `shadow_inbound_pad_midi_active()` exposed via shadow_ui.

Builds: dist/davebox-module.tar.gz current. `~/schwung/build/shadow/shadow_ui` deployed to `/data/UserData/schwung/shadow/` on Move (includes phase-1-inbound commits).

---

## Architecture summary

**On patched Schwung** (`shadow_inbound_pad_midi_active` exposed):
- Pad press → shim delivers MIDI to dAVEBOx DSP `on_midi` on the audio thread.
- `on_midi` looks up `inst->pad_note_map[active_track][padIdx]` and calls `live_note_on / live_note_off`.
- JS `S.dspInboundEnabled = true` → `liveSendNote` skips `queueLiveNoteOn/Off` for note events on ROUTE_MOVE and ROUTE_SCHWUNG.
- Recording: JS still sends `tN_record_note_on / tN_record_note_off`. `on_midi` skips note-on when armed on ROUTE_MOVE (record_note_on inline-monitors); dispatches normally when armed on ROUTE_SCHWUNG (record_note_on doesn't monitor there).
- Capability signal: `tN_padmap` handler sets `inst->dsp_inbound_enabled = 1`. Survives DSP instance destroy/recreate (state load) because JS re-pushes on every `computePadNoteMap` recompute.

**On stock Schwung** (`shadow_inbound_pad_midi_active` undefined):
- JS path unchanged. `S.dspInboundEnabled = false`, no padmap push, DSP gate stays 0, `on_midi` (not called by shim) is dormant.
- Identical behavior to pre-Phase-1 builds.

**JS-side gate sites** marked with `PHASE-1: remove when patches upstreamed` for the eventual cleanup pass when the shim patches land in official Schwung:
- `computePadNoteMap` push (entire block).
- `liveSendNote` ROUTE_MOVE branch (note-event skip).
- `liveSendNote` ROUTE_SCHWUNG branch (note-event skip).
- `init()` capability detection.

**DSP-side gate sites** marked similarly:
- `on_midi` early-return on `!dsp_inbound_enabled`.
- `tN_padmap` handler's `dsp_inbound_enabled = 1` line.

---

## What's NOT done yet (resume here next session)

### Open work

1. **End-of-refactor coordinated drop** — all Phase 1 bundles complete; ready to roll up.
   *(See also: "Parked — explicitly out of scope for this refactor" below for followups.)*
   - Merge `legsmechanical/schwung:phase-1-inbound` → `legsmechanical/schwung:main`, push fork.
   - Merge `phase-1-bundle-1` → `phase-1-bundle-2` → `main` (on `legsmechanical/schwung-davebox`), push origin.
   - Regenerate `patches/davebox-local.patch` via `git -C ~/schwung diff v0.9.13..main -- src/` and commit on dAVEBOx main.
   - End-of-Phase-1 cleanup pass: remove all `PHASE-1: remove when patches upstreamed` JS+DSP gate sites, delete dead `effectiveVelocity()` no-op at `ui.js:987`, etc. Per master plan §Cleanup.
   - Cut release (probably `0.5.0`+).
   - Do NOT skip steps or merge piecemeal — see `feedback_phase_1_no_main_until_done.md`.

### Parked — explicitly out of scope for this refactor (revisit post-Phase-1)

- **Drum repeats (Rpt1 / Rpt2) and looper during count-in.** Bundle 1.6 deliberately left `looper_tick`, `drum_repeat_tick`, and `drum_repeat2_tick` dormant during count-in (only `tarp_tick` was wired in). The likely-real omission is **drum repeats** — same input-side parallel as TARP, so holding a drum pad with repeat armed through count-in is silent today even though it sounds correctly with transport stopped. Looper-during-count-in is more design-question than bug. **SEQ ARP (`arp_tick`) is correctly dormant** — it's playback-side and there's no clip playback during count-in. Memory: `project_drum_repeats_during_countin.md`. Folds with the InQ-while-stopped behavior change (next item) into one post-Phase-1 mini-pass.

- **Drum repeat InQ behavior changes** (two items). Memory: `project_drum_repeat_inq_behavior.md`. Both are *desired* changes flagged during 2C-Rpt1 testing, NOT regressions. (1) InQ should sync repeats regardless of playback state — today the stopped-path bails to `drum_repeat_pending=0` and fires immediately; should use `arp_master_tick` as the InQ phase clock. (2) Repeats should record at the repeat rate's natural sub-step offsets, not snapped to InQ-rate step-0. Both need design pass + share the same investigation surface as the count-in dormancy item.

- **Delete+Play universal unlatch.** Memory: `project_delete_play_universal_unlatch.md`. Hold Delete + tap Play → kill TARP latches + Rpt1 latches + every Rpt2 lane-latch bit across all 8 tracks. Pure JS handler iterating tracks, calling existing per-engine stop set_params. No architectural dependency on anything. ~30min when picked up.

- **Modal pad-interception regression (class of bug).** Memory `project_modal_pad_interception_regression.md`. User flagged 2026-05-17 mid-Bundle-2B: tap-tempo pads play notes, AND ARP step-edit pads play notes — both because the modal handlers swallow pad events in JS but `on_midi` runs in parallel and fires the lane/vel-zone note regardless. **Delete-held is now covered** by Bundle 2C-Rpt2's `inst->delete_held` flag — DSP `drum_pad_event` returns 1 at top when set. Same fix-shape applies to Shift / Copy / Mute / Capture and to dialog modals (bake confirm, inherit picker, scene-save, capture-held lane select, Loop+step-range gesture, global menu). Generalize `inst->delete_held` into a `modal_pad_block` bitmask when picked up; JS pushes the bit on each modifier edge.

### Already done (confirmed)

- ~~**Vanilla Schwung fallback test**~~ — **PASSED 2026-05-16.** Deployed v0.9.13 binaries from `/tmp/schwung-vanilla/schwung.tar.gz`. dAVEBOx detected `shadow_inbound_pad_midi_active` absent → `S.dspInboundEnabled=false` → pre-Phase-1 path. User confirmed: pad presses, recording, session-view clip-launch all work as before. Patched binaries restored after test (backups at `*.patched.bak` on Move).
- ~~**Bundle 1.5 (count-in preroll + window-aware recording)**~~ — **VERIFIED + COMMITTED + PUSHED 2026-05-16.** Commit `a46bb3c`. See CHANGELOG `[Unreleased]` for user-facing summary.
- ~~**Bundle 1.6 (ARP IN during count-in)**~~ — **VERIFIED + COMMITTED 2026-05-16** (commit `eaa0af9`). User-verified the three scenarios it targets: loop_start=0 + sync=on hold-through-count-in, loop_start=0 + sync=off hold-through-count-in, and loop_start>0. Captured-but-cut-off symptom on initial deploy was traced to a `send_panic` broadcast at fire (flooded MIDI ring buffer on ROUTE_SCHWUNG); replaced with per-track event-reschedule-to-fire_at=0 and verified clean. CHANGELOG `[Unreleased]` and MANUAL §Count-in pre-roll updated in the same commit.
- ~~**Commit the uncommitted slot-fix + session-view-gate + drum-lane-assign work**~~ — **DONE.** Five commits on the branch as listed above. All pushed to `origin/phase-1-bundle-1`.

---

## Bundle 1.5 — shipped (reference)

Bundle 1.5 (commit `a46bb3c`) folded two related fixes:

1. **Count-in preroll capture window.** Presses in the first 7/8 of count-in are monitored only; presses in the last 1/8 land at `loop_start * tps` when transport flips. Filter is in DSP `on_midi` (last 1/8 note = `count_in_ticks <= PPQN/2`). JS-side `recordCountingIn` gate dropped — DSP is authoritative on patched. `record_count_in` handler clears slot active flags so stale flags don't leak. Slot-mandatory rule on patched: record handlers `continue` if no active on_midi slot (drops filtered preroll presses).

2. **Window-aware recording.** Every recording path was collapsing window-anchored ticks with `% (length * tps)` before insertion, stripping `loop_start`. All sites — record_note_on/off, drum_record_note_on/off, tarp_fire_step, finalize_pending_notes — now treat `current_clip_tick` / slot snapshots as already window-anchored. Drum write/close-gate bounds widened from `step < length` to `step < (loop_start + length)`; drum wrap math returns to `loop_start` instead of 0 at window end. Unsigned-wraparound gate math for window-crossing held notes verified correct.

**Why folded into one commit:** the count-in preroll uses a synthetic tick = `loop_start * tps`; without the window-aware fix, that would be modulo'd by `length*tps` to 0 for `loop_start=length` clips. They're coupled.

---

## Device-test plan (run before merging)

Goal: ~1 hour of real-music playing on patched Schwung. Hit the things below. Anything weird that isn't on the "expected NOT to work" list is a real regression.

### Expected NOT to work (post-2B — remaining Bundle 2C territory)

| Feature | What's missing | Bundle |
|---|---|---|
| **Note Repeat (Rpt1 / Rpt2) classifier on DSP audio thread** | JS still owns the rate / lane / vel-pad classifier. `drum_pad_event` returns "handled, don't dispatch" for Rpt activation pads (right-half rate pads in Rpt1, left-half lane pads in Rpt2) so the existing `tN_drum_repeat_start` / `tN_drum_repeat2_lane_on` flow keeps working. JS-tick wobble between physical press and JS handler is the symptom 2C closes. | 2C |
| **Modal pad-interception** (tap tempo, ARP step-edit, others) | JS modal handlers swallow pad events in `_onPadPress`/`_onPadRelease` but `on_midi` runs in parallel and fires the lane/vel-zone note. See parked section above. | post-Phase-1 |

### Shipped + verified — DO flag if it regresses

- **VelIn (per-track velocity override)** — Bundle 2B (`c4bd0fc`). Applied in `on_midi` via `effective_vel`. Stock Schwung still uses JS-side application in `liveSendNote` (marked PHASE-1).
- **Drum velocity zones** — Bundle 2A (`ddd81da`). Right-half pads classified by `drum_pad_event`, fires active lane note at zone velocity, records via JS-pushed `tN_drum_record_note_on` after slot population.
- **TARP arp respects VelIn** — Bundle 2B incidental fix. Held-pad velocity is now scaled before `tarp_tick` reads it.

### Expected TO work — verify these

- **Chord cohesion** — press 3-4 pads simultaneously; should sound tight (no late notes). This is the actual Bundle 1 win.
- **Single-note latency** — should feel snappier than pre-Phase-1.
- **TARP, NOTE FX, HARMZ, MIDI DLY on melodic** — `live_note_on` routes through the pfx chain so these effects apply to live pad input.
- **Melodic recording** when armed — records AND monitors, no doubles.
- **Drum recording** when armed — drum lane fires, records, no doubles.
- **Octave shift** (Up/Down arrows on melodic) — already verified, but re-confirm under real use.
- **Drum lane page paging** (Up/Down on drum) — already verified.
- **Track switching** — Shift+pad and Shift+jog both.
- **Step playback** — untouched DSP render path; should be unchanged.
- **External MIDI in via cable 2** (USB MIDI input) — separate `on_midi` path; should be untouched.
- **Looper capture** — `pfx_send` captures emitted notes; should work.
- **ROUTE_EXTERNAL output** — USB MIDI out; JS path preserved for that.

### Edge cases worth probing

- **State load / set switch.** Switch sets while dAVEBOx is open. DSP destroys & recreates the instance. The first pad press AFTER the switch may be silent — `pad_note_map` and `dsp_inbound_enabled` are reset, and nothing re-pushes `tN_padmap` until the user does something that triggers `computePadNoteMap` (octave shift, track switch, key change, etc.). If this happens, the fix is to add an explicit `computePadNoteMap()` call in the `pendingDspSync` completion path (after `restoreUiSidecar(true)`).
- **Schwung overtake exit + re-entry.** Does `S.dspInboundEnabled` survive a Shift+Back + re-enter cycle? Should, but worth checking.
- **Rapid chord stress test.** Tight succession of chord on/off events. Watch for stuck notes or dropped events.
- **Stock-Schwung fallback** (if a stock build is around). Confirm no regression on unpatched Schwung.

---

## Critical lessons learned this session

1. **Schwung host silently drops module-defined global set_param keys.** Only per-track-prefixed (`tN_*`) keys reliably reach DSP. Burned many cycles before discovering. Solution: piggyback signals onto an existing `tN_*` push (e.g. `tN_padmap` handler now also sets `active_track` and `dsp_inbound_enabled`). Memory saved at `feedback_schwung_drops_global_set_param.md`.
2. **DSP instance destroy/recreate (state load path) wipes runtime flags.** Initial JS pushes happen BEFORE the recreate, so any one-shot init push is lost. Solution: push on every relevant action so any recompute restores the flag. Memory: see `feedback_create_instance_loads_state` (existing).
3. **`host_module_set_param('debug_log', msg)` is unreliable in practice.** The DSP handler exists and `seq8_ilog` works internally, but JS-initiated calls were never observed reaching the log in this session. Don't trust this pattern. Memory updated.
4. **`shadow_*` JS functions ARE exposed to module JS context** despite being registered in shadow_ui's own JS context — confirmed by the corun pattern. Worth verifying if confused about scope.
5. **Recording double-monitor caveats are route-dependent.** ROUTE_MOVE: `record_note_on` inline-monitors (so on_midi must skip when armed). ROUTE_SCHWUNG: `record_note_on` does NOT monitor (so on_midi must dispatch even when armed). Different gates per route.
6. **JS dispatch path applies `trackOctave * 12` at dispatch time, not in `computePadNoteMap`.** Phase 1 must bake the offset into the DSP push to preserve the behavior. Leave `S.padNoteMap` itself unshifted so stock fallback still works correctly.

### Bundle 2 additions

7. **`replace_all` on `X[t] = arg;` when migrating to a `setX` helper matches the helper's OWN internal write.** Burned on first Bundle 2A deploy — `setActiveDrumLane` recursed forever, stack overflow on init, dAVEBOx "Loading…" bounces back to tool menu. Memory: `feedback_replace_all_self_referential_helper.md`. Fix shape: write the helper's internal assignment in a syntactically-distinct form (`const arr = S.x; arr[t] = arg;`) FIRST, then do the migration. Or use per-site Edits instead of `replace_all`.

8. **Recording-slot mandatory rule (Bundle 1.5) applies to vel-pad recording too.** `drum_record_note_on` on patched Schwung drops the record if `on_midi_drum_press_active[t][lane] == 0`. Vel-pad presses fire `live_note_on` for the ACTIVE lane's note, but the active lane's slot wasn't populated (only pitch-matching slots were). `drum_pad_event` now explicitly populates the slot for the active lane on vel-pad press when recording/preroll is active.

9. **Rpt-mode gate must be on perform_mode mirror, NOT `drum_repeat_active`.** First Bundle 2A attempt gated on `drum_repeat_active` (the DSP flag for "Rpt fire loop running"). That flag flips AFTER the rate-pad set_param processes, so the FIRST rate-pad press still saw the flag as 0 and `drum_pad_event` fired a preview note in parallel with the first repeat. New `drum_perform_mode[NUM_TRACKS]` mirror is set by JS BEFORE the user can press any rate pad, so `on_midi` always sees the right state.

10. **Rpt1 vs Rpt2 activation paths are asymmetric on the pad layout.** Rpt1 activates via right-half rate pads; Rpt2 activates via left-half lane pads. `drum_pad_event` must skip dispatch for BOTH (in Rpt1 mode for right-half, in Rpt2 mode for left-half) or one of them double-triggers. Missing the Rpt2 case was the 2A-fixup commit (`4b6fca9`).

11. **TARP-respects-VelIn was a latent bug pre-Phase-1, fixed incidentally by 2B.** `tarp_fire_step` doesn't call `effective_vel` (only `drum_repeat_tick`/`drum_repeat2_tick` did). But TARP reads held-pad state populated by `live_note_on`, so once VelIn is applied at the entry point (2B), TARP inherits it for free with no `tarp_fire_step` change. Open product question whether the pre-fix behavior (TARP raw vel) was intentional; treated as a bug for the user-facing fix.

### Bundle 2C additions

12. **Host drains `set_param` BEFORE `on_midi` within a buffer — defensive clears in `_on_internal` helpers stomp JS edges.** Initial 2C-Rpt2 attempt cleared `tr->drum_repeat2_latched_lanes &= ~bit` at the top of `_lane_on_internal`, mirroring a pattern from Rpt1. Bug: the host drains all set_params before dispatching `on_midi` for that same audio buffer. JS's `tN_drum_repeat2_lane_latched <lane> 1` push lands first; `drum_pad_event` then calls `_lane_on_internal`, which immediately stomps the bit back to 0. Latch never sticks. Fix: drop the defensive clear; JS is authoritative and pushes the explicit 0 OR 1 edge on every relevant press. Same lesson applied to Rpt1's `drum_repeat_start_internal`. Header comments on both helpers now document the contract.

13. **Atomic compound `set_param` operations beat per-key edge fan-out for multi-target writes.** Loop-held + multi-pad press in Rpt2 needs to flip the latched bit for multiple lanes in one onMidiMessage callback. Per-lane edge pushes (`tN_drum_repeat2_lane_latched <lane> 1`) coalesce — same key, different args → only the last lane lands. Fix: a new atomic `tN_drum_repeat2_latch_held` handler that ORs `active | pending` into `latched` in one DSP-side operation. Single push from JS, deterministic outcome. Pattern is reusable for any compound state mutation that touches multiple slots from one event.

14. **Same-shape `tN_*` rapid fan-out within one onMidiMessage callback can coalesce — even when keys are textually distinct.** Empirically observed during the Delete+pad probe: 8 calls in a tight for-loop `host_module_set_param('t' + _t + '_delete_held', _v)` resulted in ONLY `t7_delete_held` landing at DSP. `t0`..`t6` were silently dropped. Other sites that push two or three different `tN_*` keys in tight succession DO land all of them, so the limit isn't strict-1-per-callback — it's some host queue depth / coalescing heuristic on rapid same-suffix pushes. Workaround: if the value is global (same for all tracks), use ONE push to any tN carrier and read at instance scope. `inst->delete_held` is the shipped example. Memory worth saving.

15. **Same-buffer race in `drum_pad_event`: write `active_drum_lane` synchronously to handle rapid lane→rate gestures.** A user pressing a lane pad and a rate pad in tight succession can land both events in the same audio buffer. `drum_pad_event` for the rate pad reads `tr->active_drum_lane`, which JS hadn't pushed yet (JS pushes are deferred to next tick). Fix: in the Rpt2 lane-pad press branch, write `tr->active_drum_lane = lane` synchronously on the audio thread before calling `_lane_on_internal`. JS's subsequent push of the same value is idempotent.

16. **Multi-lane simultaneous release on one audio buffer needs DSP-side handling, not JS-side per-lane stops.** Releasing 2+ Rpt2 lane pads in one onMidiMessage callback: 2+ `tN_drum_repeat2_lane_off <lane>` pushes coalesce, only one lane stops, others keep firing as ghost-latched. Fix: handle the release directly in `drum_pad_event` — each lane processed synchronously on the audio thread, no JS coalescing surface.

17. **Runtime invariant checks earn their keep for JS-authoritative-but-DSP-mirrored state.** When the latched-bit lifecycle was moved fully under JS control (no defensive clears in DSP helpers), a future regression could push a `latched=1` edge without engaging the engine — leaving a phantom latched bit that `drum_pad_event`'s unlatch-tap branch would dutifully try to stop a non-running engine for. Added rate-limited `seq8_ilog` checks in `drum_repeat_tick` / `drum_repeat2_tick` asserting `latched ⊆ active ∪ pending`. Costs ~3 lines of code per engine; catches the next bug before device testing.

---

## Bundle 2A — shipped (reference)

Bundle 2A (commit `ddd81da` + fixup `4b6fca9`) restores drum vel-zone behavior on patched Schwung that Bundle 1 silently broke. Four threads:

1. **Pad-source scaffold (2.0).** `pad_source_t` enum (NORMAL / VEL_ZONE / RPT_RATE / RPT_LANE / RPT_VEL) + `inst->pad_source_scratch[NUM_TRACKS]` written before `live_note_on` and reset after. 2.0 alone publishes only NORMAL — 2B/2C add the bypass sources. Designed up-front per advisor #2 so the three sub-bundles share one classifier surface.

2. **`drum_pad_event` classifier.** Single per-track helper called from `on_midi` before the pitch lookup early-return for `pad_mode == PAD_MODE_DRUM`. Returns 1 (handled) or 0 (fall through to normal pad dispatch). Branches:
   - Right-half pad + perform_mode == 0 (NORMAL): arm `inst->drum_vel_zone_armed[t]` + cache `drum_last_vel_zone[t]`, fire `live_note_on` for active lane's note at zone velocity. Set `pad_source_scratch[t] = PAD_SRC_VEL_ZONE` around the call so 2B's VelIn application skips this preview.
   - Right-half pad + perform_mode == 1 (Rpt1) OR 2 (Rpt2): return 1 (handled — don't dispatch). JS rate/lane/vel pad classifier keeps owning Rpt activation.
   - Left-half pad + perform_mode == 2 (Rpt2): return 1. Rpt2 lane activation is left-half; JS pushes `tN_drum_repeat2_lane_on` and DSP's `drum_repeat2_tick` fires the first repeat. Without this skip the first hit double-triggered (2A-fixup commit).
   - Left-half pad + perform_mode == 0 OR 1: return 0 (fall through to normal pad dispatch — Rpt1 lane play is just a single note).

3. **Vel-pad recording slot population.** When `is_on && (recording || _is_preroll)` in NORMAL mode, populate `on_midi_drum_press_step/off/active[t][active_lane]` so the JS-pushed `tN_drum_record_note_on` finds the slot. Without this the post-Bundle-1.5 preroll filter at `seq8_set_param.c:4090` drops the record.

4. **Two new DSP mirrors with JS helpers.** `active_drum_lane` and `drum_perform_mode`, both per-track, both pushed via new `tN_active_drum_lane` / `tN_drum_perform_mode` set_params at every JS mutation site. JS helpers `setActiveDrumLane` and `setDrumPerformMode` both use the array-ref-alias pattern to avoid `replace_all` self-recursion.

---

## Bundle 2B — shipped (reference)

Bundle 2B (commit `c4bd0fc`) is tiny — one DSP edit at the `on_midi` live_note_on call site. Wraps the velocity in `effective_vel(tr, raw)` (the existing helper Rpt1/Rpt2 playback already uses for VelIn). `PAD_SRC_NORMAL` is implicitly the gate — drum_pad_event sets `pad_source_scratch[t] = PAD_SRC_VEL_ZONE` around its own `live_note_on` call (and resets to NORMAL afterward), so vel-zone presses don't pass through this VelIn application path. JS `liveSendNote` block at `ui.js:2317` marked PHASE-1 (still runs on stock Schwung).

**Incidental fix: TARP arp output respects VelIn.** No code change in `tarp_fire_step`. TARP reads held-pad state populated by `live_note_on`; once VelIn is applied at the entry point, TARP inherits it. Verified on device with a chord held at low velocity + VelIn=100 → arp fires at 100.

---

## Bundle 1.6 — shipped (reference)

Bundle 1.6 (commit `eaa0af9`) closes the "TARP + count-in" gap surfaced during Bundle 1.5 device testing. Three coupled changes:

1. **TARP ticks during count-in.** `tarp_tick` called per track inside the count-in inner while loop, then `arp_master_tick++`. Mirrors the stopped block; explicitly skips `looper_tick`, `drum_repeat_tick`, `drum_repeat2_tick`, and `arp_tick` (scope-guarded — to be re-evaluated next).

2. **Sync=off preroll capture in `tarp_fire_step`.** Gate: `!tr->recording && count_in_ticks > 0 && count_in_ticks <= PPQN/2 && count_in_track == t && !tr->tarp_sync`. When open, `snap_tick = loop_start * tps`. Sync=on doesn't need this — its grid-aligned first post-fire fire lands on step 0 naturally once Piece 3 below primes `current_clip_tick`.

3. **Count-in fire branch primes per-track state for clean handoff:**
   - `_tr->current_clip_tick = loop_start * tps` — fixes the symptom where the first post-fire arp note (sync=on) was missed by capture. `tarp_tick` runs at L6744 *before* the per-track tick advance at L6857 recomputes `current_clip_tick`, so without the prime the first fire reads a stale tick.
   - Every `tarp_on` track gets `sounding_active=0`, `master_anchor=0`, `pending_first_note=(held_count>0)`, `gate_remaining=0`, `ticks_until_next=0`. Without `master_anchor=0` the first post-fire `master_pos = arp_master_tick - master_anchor` underflows and picks the wrong pattern step.
   - In-flight pfx events get rescheduled to `fire_at=0` (NOT cleared, NOT panicked). The events were pegged to count-in's high `sample_counter` which just got zeroed; rescheduling lets the queued note-offs from count-in TARP gates fire on the next `pfx_q_fire` and release Move/Schwung voices cleanly.

**Why no `send_panic` at fire (initial deploy regressed):** The first deploy of Bundle 1.6 included `send_panic(inst)` at fire to defensively release voices. On ROUTE_SCHWUNG it broadcasts 2048 note-offs (16 channels × 128 notes) in one shot, which flooded the MIDI ring buffer and ate the first audible loop step. Replacing the panic with the per-track event-reschedule (which only emits the actual queued note-offs, not all 2048 channels-notes pairs) fixed the symptom and is the shipped form.

---

## File state at end of session (2026-05-17, late evening)

```
On branch phase-1-bundle-2 (HEAD = 3336e2b, pushed to origin/phase-1-bundle-2)
Working tree clean apart from this docs commit + untracked notes below.
Untracked (notes, intentionally not committed):
  notes/DISCORD_INTRO_POST.md
  notes/RECORDING_LATENCY_EXPERIMENT.md
  notes/audit-davebox-arch.md
```

Branch stack:
- `phase-1-bundle-1` (head `2b319a2`, on `origin/phase-1-bundle-1`) — Bundles 1 + 1.5 + 1.6.
- `phase-1-bundle-2` (head `3336e2b`, on `origin/phase-1-bundle-2`) — Bundles 2.0 + 2A + 2A-fixup + 2B + 2C-Rpt1 + 2C-Rpt2.

Five code commits this session on phase-1-bundle-2 (in order):
- `ddd81da` Bundle 2.0 + 2A.
- `4b6fca9` Bundle 2A fixup (Rpt2 left-half).
- `c4bd0fc` Bundle 2B.
- `13ec307` Bundle 2C-Rpt1.
- `3336e2b` Bundle 2C-Rpt2 (amended once post-advisor review to add invariant checks, doc comments, and the `inst->delete_held` fix after the 8-track fan-out diagnostic revealed coalescing).

Plus a docs commit closing the session (this checkpoint refresh).

**Resume next session:** open `notes/phase-1-session-state.md` first (this file). Phase 1 implementation work is DONE. Next chapter is the end-of-refactor coordinated drop (see "Open work" above). Do NOT merge any bundle branch to main piecemeal — single coordinated drop per `feedback_phase_1_no_main_until_done.md`.

## Verification scenarios run this session

All against the latest tree, on patched Schwung, post-count-in:

| # | Test | Result | Evidence |
|---|---|---|---|
| 1 | 16-step hold | ✓ | gate=372 ticks ≈ 15.5 steps (sub-step hardware precision) |
| 2 | Staccato | ✓ | gates 10-15 ticks ≈ 0.4-0.6 step (user's hand precision) |
| 3 | Chord cohesion | ✓ | 3-note chord, all on_ticks within 1 tick of each other |
| 4 | Drum simultaneous | ✓ | user heard tight, by ear |
| 5 | TARP+armed | ✓ | arp fired, notes recorded |
| 6 | Cross-clip-wrap | ✓ (incidental) | chord test: one note released at clip_tick=2 (post-wrap), gate=388 = 768 - 382 + 2 (correct wrap branch) |
| -- | Count-in path | ✗ (known) | gate=12.5 steps when 16 held — see Bundle 1.5 plan |
