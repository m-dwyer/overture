# Phase 2 — Session Checkpoint (Bundle 2A redesigned + Bundle 2B shipped; modal-pad-interception regression closed)

**Saved:** 2026-05-17 (Bundle 2A redesign + Bundle 2B + modal-pad-interception fix complete, pushed).

**Status:** **✓ Phase 2 implementation COMPLETE + DEVICE-VERIFIED + PUSHED.**
- dAVEBOx `phase-2-ext-worker` head = `3dd7519`, pushed to `origin/phase-2-ext-worker`.
- Schwung fork `phase-2-ext-worker` head = `cbc4621c`, pushed to `fork/phase-2-ext-worker`. Sits on top of `aa8601ac` (the broken first-attempt Bundle 2A worker design — preserved in history; can be squashed/force-pushed at coordinated-drop time if desired).

ROUTE_EXTERNAL USB-MIDI is now audio-thread-safe via the shim's SPSC ring + audio-thread MIDI_OUT drain inside `shim_pre_transfer`. Latency floor drops from ~10.6 ms (JS tick) to ~2.9 ms (audio block).

**Discipline locked-in:** **NO main merges until both Phase 1 AND Phase 2 complete + verified end-to-end.** Same coordinated-drop rule as Phase 1 — see `feedback_phase_1_no_main_until_done.md`.

---

## Commits on `phase-2-ext-worker` (off `phase-1-bundle-2`, pushed to `origin/phase-2-ext-worker`)

- `3dd7519` **Bundle 2B + modal-pad-interception fix** —
  - DSP: `inst->ext_send_async_active` field on `seq8_instance_t`, set via 33rd token of `tN_padmap` payload. `pfx_emit` + `drum_pfx_emit` ROUTE_EXTERNAL branches build 4-byte USB-MIDI packet `{0x20|cin, status, d1, d2}` (cable-2 = USB-A out, per `SPI_PROTOCOL.md`) and call `g_host->midi_send_external(pkt, 4)` directly. Stock-Schwung fallback: when flag is 0, push to existing `ext_queue`.
  - JS: `S.extSendAsyncEnabled = (typeof shadow_overtake_send_external_async_active === 'function')` set in `init()` before `computePadNoteMap()`. Padmap push appends the flag as 33rd integer token. `tick()` ext_queue drain gated on `!S.extSendAsyncEnabled`. `liveSendNote` route=2 gated on `!(S.dspInboundEnabled && note-event)` to mirror the route=0/1 gates — prevents double-trigger now that DSP `on_midi → pfx_emit` reliably reaches USB-A.
  - Phase-1 modal-pad-interception regression closed: `_padDispatchMutedNow()` helper covers `sessionView`, all button-helds (`Shift|Delete|Copy|Mute|Capture|Loop`), `tapTempoOpen`, and ARP step-edit narrow condition (`activeBank ∈ {4,5} && knobTouched === 4 && bankParams[t][bank][4] !== 0`). `computePadNoteMap` reads helper, pushes all-0xFF when muted, tracks `S.lastPushedMuted`. Re-push triggers: (a) explicit `computePadNoteMap()` calls in `_onCC_buttons` modifier branches + `openTapTempo` / `closeTapTempo` for zero-latency on button-CC transitions; (b) `tick()`-time edge detector compares helper return to `lastPushedMuted` and re-pushes when changed — catches ARP-step-edit knob-touch and any future dialog-driven modal transitions. **`globalMenuOpen` and `rndDialogMode >= 0` intentionally NOT muted** — pads still play notes in track view while those dialogs are open (user-confirmed 2026-05-17).

## Commits on `legsmechanical/schwung:phase-2-ext-worker` (off `phase-1-inbound`, pushed to `fork/phase-2-ext-worker`)

- `aa8601ac` **Bundle 2A (BROKEN — superseded by `cbc4621c`)** — original worker-thread design: spawned `ovext_worker` pthread that called `real_ioctl(0xa, 0x300)` directly on `hardware_mmap_addr` every 1 ms. Per `SPI_PROTOCOL.md`, that ioctl ships the WHOLE 768-byte mailbox (MIDI OUT + display + audio) as one atomic transfer; firing it from a worker thread interleaved with the audio thread's per-block ioctl meant every drain shipped a partial audio frame. Loud digital noise + Move crash on first ROUTE_EXTERNAL playback during Bundle 2B verify. Kept in history for the design-lesson record.
- `cbc4621c` **Bundle 2A redesigned** — audio-thread MIDI_OUT drain inside `shim_pre_transfer`. Worker thread + its ioctl deleted; per-packet `shadow_log` calls (REALTIME_SAFETY.md §1 violation) deleted. SPSC ring + producer `overtake_midi_send_external` + drop-newest counter + sentinel `shadow_overtake_send_external_async_active` kept unchanged. New `overtake_ext_drain_into_shadow(shadow)`: drains up to 20 packets per audio block into `shadow + MIDI_OUT_OFFSET` via next-empty-slot, no syscalls, no logging. Called from `shim_pre_transfer` AFTER `shadow_clear_move_leds_if_overtake` and BEFORE the JACK MIDI writer so sequencer notes get slot priority. Audio thread is sole SPI writer — no concurrent-mmap race.

---

## Architecture summary

**On patched Schwung with Phase 1 + Phase 2 active** (`shadow_inbound_pad_midi_active` AND `shadow_overtake_send_external_async_active` both exposed):
- Pad press → shim relays to dAVEBOx DSP `on_midi` on audio thread (Phase 1).
- `on_midi → live_note_on → pfx_send → pfx_emit`. ROUTE_EXTERNAL branch builds 4-byte USB-MIDI packet `{0x20|cin, status, d1, d2}` (cable-2) and calls `g_host->midi_send_external(pkt, 4)`.
- Shim's `overtake_midi_send_external` enqueues into SPSC ring (no syscalls, no logging, audio-thread safe).
- Shim's `shim_pre_transfer` drains the ring into `shadow + MIDI_OUT_OFFSET` slots (up to 20 per block) just before its existing `ioctl(0xa, 0x300)`. SPI hardware ships the whole mailbox atomically.
- Latency floor: ~2.9 ms (one audio block at 44100/128).
- JS `S.extSendAsyncEnabled = true` → JS ext_queue drain skipped in `tick()` (DSP doesn't enqueue there anymore).
- JS `liveSendNote` route=2 skips for note events when `S.dspInboundEnabled` (DSP owns dispatch end-to-end; double-trigger prevented).

**Modal pad-dispatch suppression** (Phase 1 followup, shipped in same commit):
- Any time the helper `_padDispatchMutedNow()` returns true, `computePadNoteMap` pushes all-0xFF to DSP for the active track. DSP `on_midi` already skips 0xFF entries (same path sessionView uses).
- Coverage: `sessionView`, `Shift/Delete/Copy/Mute/Capture/Loop` helds, `tapTempoOpen`, ARP step-edit narrow condition.
- NOT muted (pads play notes through): `globalMenuOpen`, `rndDialogMode >= 0`.

**On stock Schwung** (neither sentinel exposed):
- `S.extSendAsyncEnabled = false`, `S.dspInboundEnabled = false`. Padmap never pushed. DSP `on_midi` dormant.
- ROUTE_EXTERNAL goes through DSP `ext_queue` → JS `tick()` drain → `move_midi_external_send` (the original Phase-2-pre path).
- Identical behavior to pre-Phase-2 builds.

**Gate sites** marked with `PHASE-2: remove when patches upstreamed`:
- DSP: `pfx_emit` + `drum_pfx_emit` ROUTE_EXTERNAL branches (the `if (ext_send_async_active && midi_send_external)` paths); `tN_padmap` handler 33rd-token parser.
- JS: `init()` sentinel detection, padmap push 33rd-token append, `tick()` ext_queue drain gate, `liveSendNote` route=2 gate.

---

## What's NOT done yet (resume here next session)

### Open work

1. **End-of-refactor coordinated drop** — Phase 1 + Phase 2 implementation complete; ready to roll up.
   - Merge `legsmechanical/schwung:phase-1-inbound` → `phase-2-ext-worker` → `legsmechanical/schwung:main`, push fork.
   - Merge `phase-1-bundle-1` → `phase-1-bundle-2` → `phase-2-ext-worker` → `main` (on `legsmechanical/schwung-davebox`), push origin.
   - Regenerate `patches/davebox-local.patch` via `git -C ~/schwung diff v0.9.13..main -- src/` and commit on dAVEBOx main.
   - Cleanup pass: remove all `PHASE-1:` + `PHASE-2:` gate sites (JS + DSP); delete `ext_queue` storage + `ext_queue_push` + `EXT_QUEUE_SIZE` + `get_param("ext_queue")` handler + JS `tick()` ext_queue drain. (Until upstream Schwung has BOTH patches, `ext_queue` stays as stock-fallback; once both are upstream, delete it.)
   - Cut release (likely `0.5.0`+).
   - Do NOT skip steps or merge piecemeal — see `feedback_phase_1_no_main_until_done.md`.

2. **A/B latency capture (parked, not gating).** Original Phase-2 audit verify gate. Capture ROUTE_EXTERNAL emission to DAW twice — once with sentinel forced off (legacy `ext_queue + JS-tick drain` path) and once with sentinel on (new audio-thread-drain path). Expected: ~7-8 ms improvement (JS tick floor → SPI block floor). User does not currently have DAW timestamping setup; defer until convenient or until a perceived-latency complaint motivates it. Functional correctness is independently verified.

3. **Squash/force-push decision for Schwung fork.** `aa8601ac` (broken Bundle 2A) is still on `fork/phase-2-ext-worker` underneath the redesign commit `cbc4621c`. User can: (a) leave as-is — history shows the journey; or (b) interactive rebase + force-push to squash, presenting Bundle 2A redesign as a single clean commit. Decision belongs to user; conservative default of keep-history applied.

### Parked — explicitly out of scope for this refactor (revisit post-Phase-1/2)

- **Remaining modal-pad-interception coverage.** Bake confirm dialog, inherit picker, scene-save flow, capture-held lane select (separate from Capture button), `_resolveLoopGesture` step-range. Pattern is documented: add the flag to `_padDispatchMutedNow()`. None user-flagged as leaky; revisit only if a leak is observed.
- **Per-track octave UX discoverability.** Different tracks can have different `S.trackOctave` values; same pad on different tracks plays different pitches. By design, not a bug (user confirmed). Possible future UX hints (paste-confirmation showing octave delta, "sync all tracks" gesture, OLED visual). Memory: `project_per_track_octave_ux.md`.
- **Drum repeats (Rpt1 / Rpt2) and looper during count-in.** Inherited from Phase 1 — Bundle 1.6 deliberately left dormant during count-in. Memory: `project_drum_repeats_during_countin.md`.
- **Drum repeat InQ behavior.** Inherited from Phase 1 parked items. Memory: `project_drum_repeat_inq_behavior.md`.
- **Delete+Play universal unlatch.** Global gesture to clear TARP + Rpt1 + Rpt2 latches across all tracks. Pure JS, no DSP work. Memory: `project_delete_play_universal_unlatch.md`.

---

## Critical lessons from this Phase 2 session

1. **SPI mailbox is single-channel; one ioctl per audio block.** Per `SPI_PROTOCOL.md`: `ABLSPI_WAIT_AND_SEND_MESSAGE_WITH_SIZE` (cmd `0xa`, size `0x300`) ships the full 768-byte mailbox (MIDI OUT @0-79, display, audio @256-767) atomically. There is no MIDI-only flush. Any code that wants MIDI out of Move MUST write into the mailbox MIDI_OUT region from the audio thread before its existing ioctl fires — no worker can ioctl-ship MIDI independently. ROUTE_EXTERNAL latency floor is the audio block cadence (~2.9 ms at 44100/128). Memory: `feedback_spi_single_channel.md`.
2. **Read the docs first.** Bundle 2A's initial worker-thread design (`aa8601ac`) wasn't caught by the Phase-2-pre compat audit because it relied on grepping shim source without consulting `SPI_PROTOCOL.md`. CLAUDE.md's "If unsure about a platform API, grep `~/schwung-docs/`" is mandatory, not optional.
3. **No `shadow_log` (or any file I/O) from the audio thread.** Per `REALTIME_SAFETY.md` §1, SPI callback has a ~900µs budget. Bundle 2A's per-packet diagnostics violated this. Use silent counters; expose via `get_param` if needed.
4. **USB-A out is cable-2 (`0x20 | cin` in byte 0).** Same cable nibble as ROUTE_MOVE's cable-2 MIDI inject, but on the OUT side of the same physical interface. JS `move_midi_external_send` masks this by adding it server-side; a direct C-side call doesn't get that and must encode it explicitly.
5. **Phase 1's pad-dispatch gating must be uniform across all routes.** `liveSendNote` route=2 was missing the `dspInboundEnabled` gate that routes 0 and 1 had — pre-existing Phase 1 inconsistency that only became audible when Phase 2 made ROUTE_EXTERNAL emit reliably.
6. **The Bundle 2A failure cycle (verify-by-no-crash → device crash on first real use) was a false-positive verify.** The "no crash on Bundle 2A alone" gate was deceptive because dAVEBOx still used `ext_queue` then, so the worker had nothing to drain. Bundle 2B was the first real load test. Lesson: when capability-gating a redesign, run the verify gate WITH consumers actually exercising the new path, not just installed-but-dormant.

---

## Related memories

- `project_phase_2_session_state.md` — durable session state with same SHAs + push state.
- `feedback_spi_single_channel.md` — SPI single-channel rule (the architectural truth that scopes Phase 2).
- `project_modal_pad_interception_regression.md` — modal-pad regression status (Shift + button-helds + tap tempo + ARP step-edit now covered).
- `project_per_track_octave_ux.md` — per-track octave is by-design.
- `project_phase_1_session_state.md` — Phase 1 status; ships in same coordinated drop.
- `feedback_phase_1_no_main_until_done.md` — applies to Phase 2 too.
- `phase-2-compat-audit.md` (paper, in this `notes/` dir) — Phase-2-pre audit. Q1 + Q3 still correct; Q2 ("Option A: dedicated worker thread with its own ioctl") is now known WRONG and was the cause of Bundle 2A's first-attempt failure.
- `audit-davebox-arch.md` (paper, in this `notes/` dir) — full Phase 1 + Phase 2 architectural plan. §9.5 framing for Phase 2 is correct; the consumer-thread choice in §9.5 is now superseded by the audio-thread-drain redesign.
