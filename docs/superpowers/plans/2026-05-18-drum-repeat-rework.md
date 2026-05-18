# Drum Repeats — Count-in / Repeat Sync / Record-at-Rate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Three coordinated drum-repeat behavior changes: repeats tick through count-in; a new per-track `SyncRpt` toggle (default ON) snaps the first repeat-fire to the rate grid via `arp_master_tick`; recording with InQ on no longer collapses fires to step boundaries.

**Architecture:** DSP-heavy. New `drum_repeat_sync` uint8_t field on `seq8_track_t`. DSP state version bumps v=27→v=28 (pre-public: no migration; user state files wiped before deploy). UI gets one new knob slot in bank 7 (ALL LANES). No JS-side behavior changes beyond the bank-constant binding — generic per-track bool plumbing handles set/get.

**Tech Stack:** C (DSP, Docker cross-compile for aarch64, GLIBC ≤ 2.35), QuickJS (UI runtime on Move), bash deploy scripts. No automated test framework — verification is on-device manual per the user's batch-verify convention on `1.0-tweaks`.

**Spec reference:** `docs/superpowers/specs/2026-05-18-drum-repeat-rework-design.md`

**Notes for the engineer:**
- Already on `1.0-tweaks` branch (carries two prior commits: delete+play parity, octave persistence). No new branch.
- **Commit-per-fix:** commit at end of plan, single `feat:` commit. Device verification deferred to batch at end of `1.0-tweaks`.
- **State version bump = wipe device state before deploy** (per dAVEBOx CLAUDE.md state-version-bump rule). Concrete ssh command in Task 9.
- **`seq8.c` includes `seq8_set_param.c`** — single translation unit, no extern declarations between them. Edits to either file affect the same compilation. Functions defined in seq8.c are visible in seq8_set_param.c and vice versa.
- **Logging:** `seq8_ilog(inst, msg)` writes to `seq8.log`. `seq8_ilog` has no varargs — `snprintf` into a buffer first per `[[feedback-seq8-ilog-no-varargs]]`.
- **Read the relevant section of `dsp/CLAUDE.md` and `docs/FEATURE_REFERENCE.md`** before touching drum-repeat code if you don't have current familiarity with the engines.

---

## Task 1: Add `drum_repeat_sync` field to seq8_track_t

**Files:**
- Modify: `dsp/seq8.c` — find `struct seq8_track` / `seq8_track_t` definition; add field. Also init to 1 in `create_instance` (per-track init loop).

- [ ] **Step 1: Locate the struct definition**

Run: `grep -n "typedef struct.*seq8_track\|^struct seq8_track\|drum_inp_quant" /Users/josh/schwung-davebox/dsp/seq8.c | head -10`
Expected: line numbers for the struct definition. The `drum_inp_quant` field is in the same struct — find it and add the new field nearby for locality.

- [ ] **Step 2: Add the field next to `drum_inp_quant`**

Use Edit. Find the `uint8_t  drum_inp_quant;` line (or similar — verify exact spelling first with Step 1's grep) and add the new field directly after it.

Edit `old_string`:
```c
    uint8_t  drum_inp_quant;
```

(Adjust whitespace to match the actual file — copy exactly from the Step 1 output.)

`new_string`:
```c
    uint8_t  drum_inp_quant;
    uint8_t  drum_repeat_sync;   /* 1=first fire snaps to rate grid via arp_master_tick; 0=instant. Per-track. */
```

- [ ] **Step 3: Init to 1 in `create_instance`**

Run: `grep -n "drum_inp_quant" /Users/josh/schwung-davebox/dsp/seq8.c | head -10` — find the lines where `drum_inp_quant` is initialized (typically inside a per-track init loop in `create_instance`, around line 5027 area per memory).

Use Edit to add the init right after the `drum_inp_quant` init. If existing pattern is `tr->drum_inp_quant = 0;` inside a `for (t = 0; t < NUM_TRACKS; t++)` loop, add `tr->drum_repeat_sync = 1;` immediately after.

Edit `old_string`:
```c
        tr->drum_inp_quant = 0;
```

`new_string`:
```c
        tr->drum_inp_quant = 0;
        tr->drum_repeat_sync = 1;
```

(Verify by grep that this string is unique — if not, include more surrounding context in the Edit.)

- [ ] **Step 4: Verify the struct compiles** (deferred to Task 9's full build — no isolated compile path)

---

## Task 2: Add `tN_drum_repeat_sync` set_param + get_param handlers

**Files:**
- Modify: `dsp/seq8_set_param.c` — add set_param + get_param branches

- [ ] **Step 1: Locate an analogous existing handler for shape reference**

Run: `grep -n "drum_inp_quant\|drum_inq" /Users/josh/schwung-davebox/dsp/seq8_set_param.c | head -10`
Expected: see how `drum_inp_quant` set_param + get_param handlers are wired. Mirror that shape.

- [ ] **Step 2: Add the set_param branch**

After locating the `drum_inp_quant` set_param handler in `seq8_set_param.c`, add a sibling handler for `drum_repeat_sync`.

Use Edit. `old_string` should be the closing brace of the `drum_inp_quant` set_param handler (with a few lines of surrounding context to make it unique).

The new branch:
```c
        if (!strcmp(sub, "drum_repeat_sync")) {
            tr->drum_repeat_sync = (uint8_t)(clamp_i(_v, 0, 1));
            inst->state_dirty = 1;
            return;
        }
```

- [ ] **Step 3: Add the get_param branch**

Run: `grep -n "drum_inp_quant" /Users/josh/schwung-davebox/dsp/seq8.c | grep -i "get_param\|snprintf" | head -5` to find the get_param block.

Mirror the shape:
```c
        if (!strcmp(sub, "drum_repeat_sync")) {
            snprintf(outbuf, outsize, "%u", (unsigned)tr->drum_repeat_sync);
            return outbuf;
        }
```

Add this branch in the get_param handler alongside `drum_inp_quant`'s get_param branch.

---

## Task 3: Bump DSP state version v=27 → v=28 + save/load `drum_repeat_sync`

**Files:**
- Modify: `dsp/seq8.c` — `seq8_load_state` + `seq8_save_state` (and the version constant wherever it lives)

- [ ] **Step 1: Find the state version constant**

Run: `grep -n "\"v=27\"\|v=27\\b\|STATE_VERSION\|seq8_state_v" /Users/josh/schwung-davebox/dsp/seq8.c | head -10`
Expected: the version number used in save (writing `v=27` line into the JSON-ish state file) and the gate in load (rejecting anything ≠ 27).

- [ ] **Step 2: Verify the chosen save-key suffix doesn't collide**

Run: `grep -n "\"dsy\"\|_dsy\\b" /Users/josh/schwung-davebox/dsp/seq8.c`
Expected: no matches. If matches exist, pick a different 3-char suffix (e.g. `drs`) and use it consistently below.

- [ ] **Step 3: Add the save line**

In `seq8_save_state`, find where `drum_inp_quant` is written (e.g. an `fprintf(fp, "t%ddiq=%u\n", ...)` line). Add a sibling line:

Edit `old_string` (locate the per-track loop body that writes drum_inp_quant; copy a stable snippet):
```c
        fprintf(fp, "t%ddiq=%u\n", t, tr->drum_inp_quant);
```

(Adjust to whatever the actual existing line looks like — verify exact format with Step 1's grep before editing.)

`new_string`:
```c
        fprintf(fp, "t%ddiq=%u\n", t, tr->drum_inp_quant);
        fprintf(fp, "t%ddsy=%u\n", t, tr->drum_repeat_sync);
```

- [ ] **Step 4: Add the load branch**

In `seq8_load_state`, find the parser for `t%ddiq` and add a parallel branch for `t%ddsy`. Mirror the existing shape (likely `sscanf` or `strncmp` checks against the prefix).

Use Edit to add the parallel branch immediately after the existing `t%ddiq` parser.

- [ ] **Step 5: Bump the version constant**

Use Edit to change every occurrence of the old version (27) → 28 in `seq8.c`. Use `replace_all` if the version literal appears multiple times AND is unambiguous.

Run: `grep -n "\\b27\\b" /Users/josh/schwung-davebox/dsp/seq8.c | head -20` — sanity check that the literal `27` doesn't appear in non-version contexts (it might in arrays etc.). Only change the version-specific ones; if ambiguous, use surrounding-context Edits per occurrence.

- [ ] **Step 6: Confirm CHANGELOG note about reset**

The state bump means every user's existing dAVEBOx sets get wiped on first boot. This is documented in the CHANGELOG entry (Task 11) and accounted for in deploy (Task 9 wipes state files explicitly).

---

## Task 4: Implement Repeat Sync logic (Sub-feature 2)

**Files:**
- Modify: `dsp/seq8.c` — 4 sites
  - `drum_repeat_start_internal` at L3815-3840 (Rpt1 start)
  - `drum_repeat2_lane_on_internal` at L3880-3907 (Rpt2 start)
  - `drum_repeat_tick` pending-resolve block at L3952-3962 (Rpt1 tick)
  - `drum_repeat2_tick` pending-resolve block at L4080-4101 (Rpt2 tick)

**Key semantic:** strict-next, NOT round-to-nearest. The existing `phase >= qt / 2` rounding compromise is dropped per user request.

- [ ] **Step 1: Update `drum_repeat_start_internal` (L3815-3840)**

Use Edit. Locate the InQ-sync block inside `drum_repeat_start_internal`.

`old_string`:
```c
    /* InQ sync: if playing and InQ set, arm pending if in second half of interval */
    {
        uint8_t diq = tr->drum_inp_quant;
        if (diq > 0 && inst->playing) {
            int qt = (int)DRUM_INQ_TICKS[diq];
            uint32_t abs = inst->global_tick * (uint32_t)TICKS_PER_STEP + inst->master_tick_in_step;
            int phase = (int)(abs % (uint32_t)qt);
            tr->drum_repeat_pending = (phase >= qt / 2) ? 1 : 0;
        } else {
            tr->drum_repeat_pending = 0;
        }
    }
```

`new_string`:
```c
    /* Repeat Sync: when on, first fire snaps to the next rate-grid boundary
     * on arp_master_tick. arp_master_tick free-runs across playing/stopped/
     * count-in (resets at transport play and count-in fire), so the snap
     * works in every transport state. Strict-next, not round-to-nearest:
     * a press at tick T where T % rate_ticks != 0 ALWAYS waits for the next
     * T' where T' % rate_ticks == 0. */
    {
        if (tr->drum_repeat_sync) {
            uint16_t rate_ticks = DRUM_REPEAT_RATE_TICKS[rate_idx];
            if (inst->arp_master_tick % (uint32_t)rate_ticks == 0) {
                tr->drum_repeat_pending = 0;  /* on boundary — fire on next tick */
            } else {
                tr->drum_repeat_pending = 1;  /* off boundary — wait */
            }
        } else {
            tr->drum_repeat_pending = 0;
        }
    }
```

- [ ] **Step 2: Update `drum_repeat2_lane_on_internal` (L3880-3907)**

Use Edit. Locate the InQ-sync block inside `drum_repeat2_lane_on_internal`.

`old_string`:
```c
    {
        uint8_t diq = tr->drum_inp_quant;
        if (diq > 0 && inst->playing) {
            int qt = (int)DRUM_INQ_TICKS[diq];
            uint32_t abs = inst->global_tick * (uint32_t)TICKS_PER_STEP + inst->master_tick_in_step;
            int phase = (int)(abs % (uint32_t)qt);
            if (phase >= qt / 2) {
                tr->drum_repeat2_pending |=  (1u << (unsigned)lane);
                tr->drum_repeat2_active  &= ~(1u << (unsigned)lane);
            } else {
                tr->drum_repeat2_pending &= ~(1u << (unsigned)lane);
                tr->drum_repeat2_active  |=  (1u << (unsigned)lane);
            }
        } else {
            tr->drum_repeat2_pending &= ~(1u << (unsigned)lane);
            tr->drum_repeat2_active  |=  (1u << (unsigned)lane);
        }
    }
```

`new_string`:
```c
    /* Repeat Sync: strict-next snap on per-lane rate. See drum_repeat_start_internal. */
    {
        if (tr->drum_repeat_sync) {
            uint16_t rate_ticks = DRUM_REPEAT_RATE_TICKS[tr->drum_repeat2_rate_idx[lane]];
            if (inst->arp_master_tick % (uint32_t)rate_ticks == 0) {
                tr->drum_repeat2_pending &= ~(1u << (unsigned)lane);
                tr->drum_repeat2_active  |=  (1u << (unsigned)lane);
            } else {
                tr->drum_repeat2_pending |=  (1u << (unsigned)lane);
                tr->drum_repeat2_active  &= ~(1u << (unsigned)lane);
            }
        } else {
            tr->drum_repeat2_pending &= ~(1u << (unsigned)lane);
            tr->drum_repeat2_active  |=  (1u << (unsigned)lane);
        }
    }
```

- [ ] **Step 3: Update `drum_repeat_tick` pending-resolve (L3952-3962)**

Use Edit. Locate the InQ pending-resolve block at the top of `drum_repeat_tick`.

`old_string`:
```c
    /* InQ pending: wait for nearest quant boundary before first fire */
    if (tr->drum_repeat_pending) {
        uint8_t diq = tr->drum_inp_quant;
        if (diq > 0) {
            int qt = (int)DRUM_INQ_TICKS[diq];
            uint32_t abs = inst->global_tick * (uint32_t)TICKS_PER_STEP + inst->master_tick_in_step;
            if ((int)(abs % (uint32_t)qt) != 0) return;
        }
        tr->drum_repeat_pending = 0;
        tr->drum_repeat_step    = 0;
        tr->drum_repeat_phase   = 0;
    }
```

`new_string`:
```c
    /* Repeat Sync pending: wait for next rate-grid boundary on arp_master_tick. */
    if (tr->drum_repeat_pending) {
        uint16_t rate_ticks = DRUM_REPEAT_RATE_TICKS[tr->drum_repeat_rate_idx];
        if (inst->arp_master_tick % (uint32_t)rate_ticks != 0) return;
        tr->drum_repeat_pending = 0;
        tr->drum_repeat_step    = 0;
        tr->drum_repeat_phase   = 0;
    }
```

- [ ] **Step 4: Update `drum_repeat2_tick` pending-resolve (L4080-4101)**

Use Edit. Locate the pending-resolve block in `drum_repeat2_tick`.

`old_string`:
```c
    /* Resolve any lanes pending InQ boundary */
    if (tr->drum_repeat2_pending) {
        uint8_t diq = tr->drum_inp_quant;
        if (diq > 0) {
            int qt = (int)DRUM_INQ_TICKS[diq];
            uint32_t abs = inst->global_tick * (uint32_t)TICKS_PER_STEP + inst->master_tick_in_step;
            if ((int)(abs % (uint32_t)qt) == 0) {
                /* Activate all pending lanes at this boundary */
                int pl; for (pl = 0; pl < DRUM_LANES; pl++) {
                    if (tr->drum_repeat2_pending & (1u << (unsigned)pl)) {
                        tr->drum_repeat2_phase[pl] = 0;
                        tr->drum_repeat2_step[pl]  = 0;
                        tr->drum_repeat2_active   |= (1u << (unsigned)pl);
                    }
                }
                tr->drum_repeat2_pending = 0;
            }
        } else {
            tr->drum_repeat2_active  |= tr->drum_repeat2_pending;
            tr->drum_repeat2_pending  = 0;
        }
    }
```

`new_string`:
```c
    /* Resolve any lanes pending repeat-rate boundary. Each lane has its own
     * rate; activate per-lane when its rate divides arp_master_tick. */
    if (tr->drum_repeat2_pending) {
        int pl; for (pl = 0; pl < DRUM_LANES; pl++) {
            if (!(tr->drum_repeat2_pending & (1u << (unsigned)pl))) continue;
            uint16_t rate_ticks = DRUM_REPEAT_RATE_TICKS[tr->drum_repeat2_rate_idx[pl]];
            if (inst->arp_master_tick % (uint32_t)rate_ticks == 0) {
                tr->drum_repeat2_phase[pl] = 0;
                tr->drum_repeat2_step[pl]  = 0;
                tr->drum_repeat2_active   |= (1u << (unsigned)pl);
                tr->drum_repeat2_pending  &= ~(1u << (unsigned)pl);
            }
        }
    }
```

Note: this changes behavior slightly — previously a non-InQ Rpt2 would `OR pending into active` unconditionally on first tick. With Repeat Sync replacing the InQ check, that path is gone. If `drum_repeat_sync == 0`, the lane_on_internal at Task 2 already sets `active` directly (skipping pending). So this loop only runs when at least one lane is pending due to Repeat Sync being on, which is the new correct semantic.

---

## Task 5: Implement record-at-rate (Sub-feature 3)

**Files:**
- Modify: `dsp/seq8.c` — two sites
  - `drum_repeat_tick` recording block at L4001-4034 (Rpt1)
  - `drum_repeat2_tick` recording block at L4131-4163 (Rpt2)

- [ ] **Step 1: Rpt1 recording block — remove `off=0` collapse + relax stacking gate**

Use Edit. Locate the recording block in `drum_repeat_tick`.

`old_string`:
```c
                    int inq_on = (inst->inp_quant || tr->drum_inp_quant) ? 1 : 0;
                    int16_t off = (int16_t)tr->drum_tick_in_step[lane];
                    if (off >= (int16_t)(TICKS_PER_STEP / 2)) {
                        rs = (rs + 1) % rlc->length;
                        off -= (int16_t)TICKS_PER_STEP;
                    }
                    if (inq_on) off = 0;
                    int new_step_this_pass = (tr->drum_last_rec_step[lane] != (int16_t)rs);
                    int can_write = 0;
                    if (new_step_this_pass) {
                        can_write = (rlc->step_note_count[rs] == 0);
                        tr->drum_last_rec_step[lane] = (int16_t)rs;
                    } else if (!inq_on) {
                        can_write = (rlc->step_note_count[rs] < 8);
                    }
```

`new_string`:
```c
                    int16_t off = (int16_t)tr->drum_tick_in_step[lane];
                    if (off >= (int16_t)(TICKS_PER_STEP / 2)) {
                        rs = (rs + 1) % rlc->length;
                        off -= (int16_t)TICKS_PER_STEP;
                    }
                    /* Sub-feature 3: preserve actual sub-step offset; stack regardless of InQ.
                     * Reader (note_step, clip_build_steps_from_notes) handles sub-step notes
                     * via midpoint rounding — symmetric write/read invariant per dsp/CLAUDE.md. */
                    int new_step_this_pass = (tr->drum_last_rec_step[lane] != (int16_t)rs);
                    int can_write = 0;
                    if (new_step_this_pass) {
                        can_write = (rlc->step_note_count[rs] == 0);
                        tr->drum_last_rec_step[lane] = (int16_t)rs;
                    } else {
                        can_write = (rlc->step_note_count[rs] < 8);
                    }
```

- [ ] **Step 2: Rpt2 recording block — same edits**

Use Edit. Locate the recording block in `drum_repeat2_tick`.

`old_string`:
```c
                    int inq_on = (inst->inp_quant || tr->drum_inp_quant) ? 1 : 0;
                    int16_t off = (int16_t)tr->drum_tick_in_step[l];
                    if (off >= (int16_t)(TICKS_PER_STEP / 2)) {
                        rs = (rs + 1) % rlc->length;
                        off -= (int16_t)TICKS_PER_STEP;
                    }
                    if (inq_on) off = 0;
                    int new_step_this_pass = (tr->drum_last_rec_step[l] != (int16_t)rs);
                    int can_write = 0;
                    if (new_step_this_pass) {
                        can_write = (rlc->step_note_count[rs] == 0);
                        tr->drum_last_rec_step[l] = (int16_t)rs;
                    } else if (!inq_on) {
                        can_write = (rlc->step_note_count[rs] < 8);
                    }
```

`new_string`:
```c
                    int16_t off = (int16_t)tr->drum_tick_in_step[l];
                    if (off >= (int16_t)(TICKS_PER_STEP / 2)) {
                        rs = (rs + 1) % rlc->length;
                        off -= (int16_t)TICKS_PER_STEP;
                    }
                    /* Sub-feature 3: preserve actual sub-step offset; stack regardless of InQ. */
                    int new_step_this_pass = (tr->drum_last_rec_step[l] != (int16_t)rs);
                    int can_write = 0;
                    if (new_step_this_pass) {
                        can_write = (rlc->step_note_count[rs] == 0);
                        tr->drum_last_rec_step[l] = (int16_t)rs;
                    } else {
                        can_write = (rlc->step_note_count[rs] < 8);
                    }
```

---

## Task 6: Wire drum_repeat_tick + drum_repeat2_tick into count-in (Sub-feature 1)

**Files:**
- Modify: `dsp/seq8.c` — count-in inner-while loop at L6920-6923 + reset block at L6926+

- [ ] **Step 1: Update the count-in inner-while loop**

Use Edit. Locate the `tarp_tick` call inside the count-in while loop.

`old_string`:
```c
                /* TARP: tick input-side arp during count-in so live chord presses
                 * are audible (and, for sync=off, captured via tarp_fire_step's
                 * preroll branch). Mirrors the stopped block — only TARP, not
                 * looper/drum-repeats/SEQ-ARP (those are playback-side). */
                { int _tt;
                  for (_tt = 0; _tt < NUM_TRACKS; _tt++)
                      tarp_tick(inst, &inst->tracks[_tt]);
                }
                inst->arp_master_tick++;
```

`new_string`:
```c
                /* TARP + drum repeats: input-side engines tick during count-in
                 * so live presses are audible through the click. Looper and
                 * SEQ ARP stay dormant (playback-side; no clip playback during
                 * count-in). */
                { int _tt;
                  for (_tt = 0; _tt < NUM_TRACKS; _tt++) {
                      tarp_tick(inst, &inst->tracks[_tt]);
                      drum_repeat_tick(inst, &inst->tracks[_tt]);
                      drum_repeat2_tick(inst, &inst->tracks[_tt]);
                  }
                }
                inst->arp_master_tick++;
```

- [ ] **Step 2: Add drum-repeat reset at count-in fire**

Read seq8.c:6926-7000 to see the existing fire-reset block (it currently resets tarp runtime and per-lane drum_current_step).

Find the TARP runtime reset:
```c
                    if (_tr->tarp_on) {
                        arp_engine_t *_a = &_tr->tarp;
                        _a->sounding_active     = 0;
                        _a->sounding_pitch      = 0;
                        _a->gate_remaining      = 0;
                        _a->ticks_until_next    = 0;
                        _a->master_anchor       = 0;
                        _a->pending_first_note  = (_a->held_count > 0) ? 1 : 0;
                    }
```

Use Edit to add the drum-repeat reset immediately after that block.

`old_string` (the full TARP reset block above).

`new_string` (same block, followed by drum-repeat reset):
```c
                    if (_tr->tarp_on) {
                        arp_engine_t *_a = &_tr->tarp;
                        _a->sounding_active     = 0;
                        _a->sounding_pitch      = 0;
                        _a->gate_remaining      = 0;
                        _a->ticks_until_next    = 0;
                        _a->master_anchor       = 0;
                        _a->pending_first_note  = (_a->held_count > 0) ? 1 : 0;
                    }
                    /* Drum repeat fire reset — re-anchor phase to the new
                     * arp_master_tick=0. Pending bits clear because Repeat
                     * Sync will re-evaluate (arp_master_tick=0 is always on
                     * the rate grid). Drain play_pending[] entries queued
                     * by count-in repeats so note-offs land on the first
                     * audio buffer post-fire instead of being stranded. */
                    if (_tr->drum_repeat_active) {
                        _tr->drum_repeat_phase   = 0;
                        _tr->drum_repeat_step    = 0;
                        _tr->drum_repeat_pending = 0;
                    }
                    if (_tr->drum_repeat2_active | _tr->drum_repeat2_pending) {
                        int _l2;
                        for (_l2 = 0; _l2 < DRUM_LANES; _l2++) {
                            uint32_t _bit = 1u << (unsigned)_l2;
                            if (_tr->drum_repeat2_pending & _bit) {
                                _tr->drum_repeat2_active |= _bit;
                                _tr->drum_repeat2_pending &= ~_bit;
                            }
                            if (_tr->drum_repeat2_active & _bit) {
                                _tr->drum_repeat2_phase[_l2] = 0;
                                _tr->drum_repeat2_step[_l2]  = 0;
                            }
                        }
                    }
                    /* Drain play_pending[] note-offs so they fire on the first
                     * post-count-in tick rather than waiting for their original
                     * gate countdown (those tick at count-in's high sample_counter,
                     * which has been zeroed by the reset above). */
                    {
                        int _pp;
                        for (_pp = 0; _pp < (int)_tr->play_pending_count; _pp++)
                            _tr->play_pending[_pp].ticks_remaining = 0;
                    }
```

---

## Task 7: Add SyncRpt knob to bank 7 (ALL LANES) in ui_constants.mjs

**Files:**
- Modify: `ui/ui_constants.mjs:308-315`

- [ ] **Step 1: Replace K6's `_X` with the SyncRpt knob entry**

Use Edit.

`old_string`:
```js
    /* 7 — ALL LANES (drum pad 92) — macro controls across all 32 drum lanes.
     * K2 Shft + Shift held = Nudge (replaced standalone Ndg knob). */
    { name: 'ALL LANES', knobs: [
        p('Stch', 'Beat Stretch', 'beat_stretch', 'action', 0, 0,  0,  fmtStretch, 16, '_factor', true),
        p('Shft', 'Clock Shift',  'clock_shift',  'action', 0, 0,  0,  fmtSign,    8),
        _XQ,  /* K3: quantize all lanes — custom handling, def=-1 */
        _X,   /* K4: VelIn — custom handling via trackVelOverride */
        _X,   /* K5: InQ — per-track drum input quantize, custom handling */
        _X, _X, _X,
    ]},
```

`new_string`:
```js
    /* 7 — ALL LANES (drum pad 92) — macro controls across all 32 drum lanes.
     * K2 Shft + Shift held = Nudge (replaced standalone Ndg knob). */
    { name: 'ALL LANES', knobs: [
        p('Stch', 'Beat Stretch', 'beat_stretch', 'action', 0, 0,  0,  fmtStretch, 16, '_factor', true),
        p('Shft', 'Clock Shift',  'clock_shift',  'action', 0, 0,  0,  fmtSign,    8),
        _XQ,  /* K3: quantize all lanes — custom handling, def=-1 */
        _X,   /* K4: VelIn — custom handling via trackVelOverride */
        _X,   /* K5: InQ — per-track drum input quantize, custom handling */
        p('SyncRpt', 'Repeat Sync', 'drum_repeat_sync', 'track', 0, 1, 1, fmtBool, 16),
        _X, _X,
    ]},
```

Note: label is intentionally 7 chars; spills into K7's column when idle, truncates to "Sync" inside the highlight when touched. User-accepted per spec.

---

## Task 8: Bundle UI

**Files:**
- Modify: `dist/davebox/ui.js` (auto-generated)

- [ ] **Step 1: Run the bundler**

Run: `cd /Users/josh/schwung-davebox && python3 scripts/bundle_ui.py`
Expected: bundler output ending in "Wrote dist/davebox/ui.js" with no errors.

- [ ] **Step 2: Confirm the new knob made it into the bundle**

Run: `grep -c "drum_repeat_sync" /Users/josh/schwung-davebox/dist/davebox/ui.js`
Expected: at least 1 (the new bank-7 knob entry).

---

## Task 9: Build DSP + wipe device state + deploy + reboot

**Files:** none modified locally — build/deploy step only.

- [ ] **Step 1: Run the DSP build**

Run: `cd /Users/josh/schwung-davebox && ./scripts/build.sh`
Expected: Docker cross-compile completes. No errors. Output ends with something like "Built dist/davebox/dsp.so" or similar success indicator.

- [ ] **Step 2: GLIBC sanity check**

Run: `nm -D /Users/josh/schwung-davebox/dist/davebox/dsp.so | grep GLIBC`
Expected: all GLIBC symbol versions are ≤ 2.35. If any are higher, the build won't run on Move — abort and investigate (e.g., a `<stdio.h>` include or library bringing in a newer-versioned symbol).

- [ ] **Step 3: Wipe device state files (state version bump)**

Per dAVEBOx CLAUDE.md state-version-bump rule:

Run: `ssh root@move.local "find /data/UserData/schwung/set_state -name 'seq8-state.json' -exec rm {} \; && find /data/UserData/schwung/set_state -name 'seq8-ui-state.json' -exec rm {} \;"`
Expected: command completes silently. (User accepts loss of existing dAVEBOx sets per pre-public no-migration posture.)

- [ ] **Step 4: Install**

Run: `cd /Users/josh/schwung-davebox && ./scripts/install.sh`
Expected: scp transfers succeed.

- [ ] **Step 5: Reboot Move**

Run:
```sh
ssh root@move.local "for name in MoveOriginal Move MoveLauncher MoveMessageDisplay shadow_ui schwung link-subscriber display-server schwung-manager; do pids=\$(pidof \$name 2>/dev/null || true); [ -n \"\$pids\" ] && kill -9 \$pids 2>/dev/null || true; done && /etc/init.d/move start >/dev/null 2>&1"
```
Expected: command exits silently. Move's display goes black, then boots back up.

---

## Task 10: Update MANUAL.md

**Files:**
- Modify: `docs/MANUAL.md` — three sites

- [ ] **Step 1: Locate the bank 7 knob list**

Run: `grep -n "ALL LANES\|Stch\|Beat Stretch" /Users/josh/schwung-davebox/docs/MANUAL.md | head -10`
Expected: line numbers where the ALL LANES bank knob list lives.

Read 10–20 lines around the matches to find the table.

- [ ] **Step 2: Add SyncRpt to the bank 7 knob list**

Use Edit. Add a row for K6 = SyncRpt in the bank 7 table. Mirror the formatting of existing rows. The label is "SyncRpt" / long name "Repeat Sync" / behavior: "Default ON. When ON, first repeat-fire of a held drum pad snaps to the next rate-grid boundary regardless of transport state."

- [ ] **Step 3: Update Rpt1/Rpt2 behavior sections**

Run: `grep -n "InQ\|input quantize\|count-in\|count in" /Users/josh/schwung-davebox/docs/MANUAL.md | head -20`
Find the sections that describe Rpt1 / Rpt2 first-fire behavior and InQ's effect on it. Edit to:
- Explain that Repeat Sync (not InQ) now controls first-fire snap timing.
- Note that repeats now run through count-in (audible).

Use Edit per section; mirror the existing prose style. Strict-next semantic should be made clear ("first fire waits until the next rate-grid boundary on a free-running clock that resets at transport start / count-in fire").

- [ ] **Step 4: Update recording section**

Find the section about how InQ affects recording. Edit to clarify:
- InQ still snaps live (non-repeat) pad presses to step boundaries on record.
- InQ no longer affects how repeat fires are recorded — each repeat fire now writes at its actual sub-step offset, regardless of InQ.

---

## Task 11: Update CHANGELOG.md

**Files:**
- Modify: `CHANGELOG.md` — add a `### Features` subsection under `[Unreleased]`

- [ ] **Step 1: Read the current [Unreleased] section**

Run: `sed -n '1,25p' /Users/josh/schwung-davebox/CHANGELOG.md`
Expected: see the existing `### Fixes` subsection populated by the prior two `1.0-tweaks` commits. No `### Features` subsection yet.

- [ ] **Step 2: Add `### Features` and the entry**

Use Edit. Insert immediately after the `## [Unreleased]` heading and before the existing `### Fixes` subsection, since Features typically appears first in keep-a-changelog ordering.

Add this block:

```markdown
### Features
- **Drum repeats during count-in + first-fire Repeat Sync + true sub-step recording.** Holding a Rpt1 / Rpt2 pad through count-in now sounds the repeats audibly through the click, then fires seamlessly into the recorded clip at the loop window start — same warm-up affordance ARP IN already has. A new per-track Repeat Sync toggle (ALL LANES bank K6, default ON) replaces the old InQ-tied first-fire snap: when on, the first repeat-fire of a press waits for the next rate-grid boundary (anchored to a free-running clock that resets at transport play / count-in fire) regardless of whether transport is stopped or playing; when off, the first fire is instant. And when recording with InQ on, every repeat fire now writes its actual sub-step offset into the clip instead of collapsing to the step boundary — a 1/32 rate played against a 1/16 step grid records as a true 1/32 cadence with adjacent-step notes carrying their own offsets, exactly the timing you heard. DSP state bumped to v=28; user clips will reset on first boot of this build per the pre-public no-migration posture.

```

---

## Task 12: Commit on 1.0-tweaks

**Files:** none modified — git operations only.

- [ ] **Step 1: Review diff**

Run: `git -C /Users/josh/schwung-davebox status && echo "---" && git -C /Users/josh/schwung-davebox diff --stat`
Expected: modified files = `dsp/seq8.c`, `dsp/seq8_set_param.c`, `ui/ui_constants.mjs`, `docs/MANUAL.md`, `CHANGELOG.md`. New file = `docs/superpowers/specs/2026-05-18-drum-repeat-rework-design.md` and `docs/superpowers/plans/2026-05-18-drum-repeat-rework.md`.

- [ ] **Step 2: Stage**

Run:
```sh
git -C /Users/josh/schwung-davebox add dsp/seq8.c dsp/seq8_set_param.c ui/ui_constants.mjs docs/MANUAL.md CHANGELOG.md docs/superpowers/specs/2026-05-18-drum-repeat-rework-design.md docs/superpowers/plans/2026-05-18-drum-repeat-rework.md
```

- [ ] **Step 3: Commit**

Run:
```sh
git -C /Users/josh/schwung-davebox commit -m "$(cat <<'EOF'
feat: drum repeats during count-in + Repeat Sync toggle + true sub-step recording

Three coordinated drum-repeat behavior changes plus one new per-track
control surface.

1. drum_repeat_tick + drum_repeat2_tick now run through count-in
   alongside tarp_tick — holding a Rpt1/Rpt2 pad through the click is
   audible. Reset block at count-in fire re-anchors phase to the new
   arp_master_tick=0 and drains play_pending[] so note-offs land
   cleanly on the first post-fire buffer. Looper and SEQ ARP stay
   dormant (playback-side).

2. New per-track drum_repeat_sync (uint8_t bool, default 1) lives at
   ALL LANES bank K6 with label "SyncRpt" (idle render spills into K7
   column; truncates to "Sync" inside highlight when touched per user
   trade-off). Replaces the InQ-tied first-fire snap in both Rpt1 and
   Rpt2 start_internal + tick paths. Uses arp_master_tick as a
   free-running PPQN clock that resets at transport play / count-in
   fire; snaps to (arp_master_tick % rate_ticks == 0). Strict-next
   semantic — does NOT round to nearest (existing code's phase >= qt/2
   compromise deliberately dropped for predictability per user).

3. drum_repeat_tick + drum_repeat2_tick recording blocks drop the
   inq_on -> off=0 collapse and allow stacking regardless of InQ.
   Reader (note_step, clip_build_steps_from_notes) already handles
   sub-step offsets via midpoint rounding; the write side now matches
   what the read side has always done.

DSP state bumped to v=28 — state-bump posture: pre-public, no
migration, deploy wipes seq8-state.json + seq8-ui-state.json on
device per CLAUDE.md state-version rule.

CHANGELOG entry under [Unreleased] -> Features. MANUAL updated for
bank 7 knob list, Rpt1/Rpt2 behavior, and recording semantics.

Spec + plan in docs/superpowers/.

Verification deferred to end-of-batch device pass on 1.0-tweaks per
user batch-verify convention.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```
Expected: commit succeeds. Pre-commit hooks pass.

- [ ] **Step 4: Confirm tree state**

Run: `git -C /Users/josh/schwung-davebox log --oneline -5`
Expected: new commit at HEAD of `1.0-tweaks`, with the prior two `1.0-tweaks` commits (delete+play, octave persistence) directly below.
