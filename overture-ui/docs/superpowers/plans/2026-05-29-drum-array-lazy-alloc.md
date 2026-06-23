# Drum Array Lazy Allocation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace inline `drum_clip_t drum_clips[NUM_CLIPS]` with pointer-based lazy allocation so drum clip memory is only allocated for tracks in drum mode, saving ~52MB typical runtime RAM.

**Architecture:** Per-track allocation — when a track switches to drum mode (via `tN_pad_mode`, `tN_convert_to_drum`, or state load), all 16 drum clips for that track are `malloc`'d. When switching back to melodic, they're `free`'d. This keeps `malloc`/`free` out of the audio render path — allocation happens on explicit user action (mode switch button press) or at startup (state load). Inner `for l in 0..DRUM_LANES` loops remain unchanged since all 32 lanes always co-exist within an allocated clip.

**Savings:**
- Default (1 drum track): 1 × 16 × 468KB ≈ 7.5MB vs 60MB today → **~52MB saved**
- 2 drum tracks: ~15MB → **~45MB saved**
- Worst case (8 drum tracks): 60MB — same as today, no regression

**Tech Stack:** C (DSP), single translation unit (`seq8.c` includes `seq8_set_param.c`). No test suite — all verification on-device (Ableton Move).

**Key constraints:**
- **Malloc only on rare user-initiated mode switch** — still set_param/audio-thread context, but outside the per-note/render hot path. A one-time ~7.5MB calloc on drum-mode switch is acceptable (16 × 468KB, user pressed a button).
- **No cap.** All 128 drum clips remain available (8 tracks × 16 clips). No exhaustion policy needed.
- **Backward compatible.** No state version bump. Existing state files load identically.
- **Per-block granularity.** Each `drum_clip_t` is all-32-lanes-or-nothing. NULL = clip not allocated.
- **Invariant: `pad_mode == DRUM` ⟺ drum_clips allocated.** Every code path that checks `pad_mode == PAD_MODE_DRUM` can assume non-NULL drum_clips. Every mode transition must maintain this invariant.

**Critical path — state reload on live instance:**
`state_load` set_param handler (seq8_set_param.c:856) re-runs `seq8_load_state` on an already-initialized instance (set switch, resume UUID mismatch). The handler resets all tracks to MELODIC (line 898) then calls `drum_track_init` (line 923) before `seq8_load_state` (line 960). With lazy alloc, **`drum_clips_free` must be called before `drum_track_init`** to avoid leaking the old set's drum clips. The load path then re-allocates for tracks that are DRUM in the new state file.

**Allocation trigger points:**
1. `drum_track_init` — called from `create_instance` (all tracks melodic by default, no alloc)
2. State load — `pad_mode` loaded, drum clips allocated for drum-mode tracks
3. `tN_pad_mode` set to DRUM — allocate all 16 clips
4. `tN_convert_to_drum` — allocate before conversion
5. Clear Session — free all, then `drum_track_init` (no alloc)

**Free trigger points:**
1. `tN_convert_to_melodic` — free after converting notes back
2. `tN_pad_mode` set to MELODIC — free all 16 clips
3. Clear Session — free all
4. `destroy_instance` — free any remaining

---

### Task 1: Pointer conversion + allocation helpers

**Files:**
- Modify: `dsp/seq8.c:509-511` (drum_clip_t struct unchanged)
- Modify: `dsp/seq8.c:592` (track struct: inline array → pointer array)
- Modify: `dsp/seq8.c` ~line 512 (add helpers after struct defs)

- [ ] **Step 1: Convert drum_clips to pointer array in track struct**

At `dsp/seq8.c:592`, change:

```c
/* Before: */
drum_clip_t drum_clips[NUM_CLIPS];

/* After: */
drum_clip_t *drum_clips[NUM_CLIPS];
```

- [ ] **Step 2: Add allocation/free helpers after the struct definitions (~line 512)**

```c
/* Allocate all 16 drum clips for a track. Called on drum-mode entry.
 * Safe to call if already allocated (idempotent). */
static void drum_clips_alloc(seq8_instance_t *inst, seq8_track_t *tr) {
    int c, l;
    for (c = 0; c < NUM_CLIPS; c++) {
        if (tr->drum_clips[c]) continue;
        tr->drum_clips[c] = (drum_clip_t *)calloc(1, sizeof(drum_clip_t));
        if (!tr->drum_clips[c]) {
            seq8_ilog(inst, "drum_clips_alloc: calloc failed");
            continue;
        }
        for (l = 0; l < DRUM_LANES; l++) {
            clip_init(&tr->drum_clips[c]->lanes[l].clip);
            drum_pfx_params_init(&tr->drum_clips[c]->lanes[l].pfx_params);
            tr->drum_clips[c]->lanes[l].midi_note = (uint8_t)(DRUM_BASE_NOTE + l);
        }
    }
}

/* Free all 16 drum clips for a track. Called on melodic-mode entry.
 * Safe to call if already freed (idempotent). */
static void drum_clips_free(seq8_track_t *tr) {
    int c;
    for (c = 0; c < NUM_CLIPS; c++) {
        free(tr->drum_clips[c]);
        tr->drum_clips[c] = NULL;
    }
}
```

Note: these helpers reference `seq8_ilog`, `clip_init`, `drum_pfx_params_init`, `DRUM_BASE_NOTE`, `DRUM_LANES`, `NUM_CLIPS` — all defined above the insertion point. Also references `seq8_instance_t` which is defined later. The helpers need a forward declaration or must be placed after the instance struct. **Place them immediately after the `seq8_instance_t` struct definition** (after the closing `}` around line 930) since they need `seq8_ilog` which takes an `inst` pointer.

Actually, `seq8_ilog` is defined around line 190 and only needs `inst->log_fp`. Check that `seq8_instance_t` is defined before the helper placement. If not, use a forward declaration or move the helpers to after the instance struct.

- [ ] **Step 3: Compile to see where things break**

```bash
./scripts/build.sh 2>&1 | grep 'error:' | head -20
```

Expect many errors from `tr->drum_clips[c].lanes` → needs `tr->drum_clips[c]->lanes` (and NULL guards). That's Tasks 2-5.

- [ ] **Step 4: Commit infrastructure**

```bash
git add dsp/seq8.c
git commit -m "feat: drum_clips pointer conversion + alloc/free helpers

drum_clip_t drum_clips[16] → drum_clip_t *drum_clips[16] in track struct.
drum_clips_alloc() mallocs all 16 clips for a track on drum-mode entry.
drum_clips_free() releases them on melodic-mode entry.
Does not compile yet — access site conversions in subsequent commits."
```

---

### Task 2: Wire allocation into lifecycle (mode switch, state load, init, destroy)

**Files:**
- Modify: `dsp/seq8.c:5701-5720` (drum_track_init)
- Modify: `dsp/seq8.c:1764` (state load — pad_mode, then alloc)
- Modify: `dsp/seq8.c:6109` (destroy_instance)
- Modify: `dsp/seq8_set_param.c:2550-2553` (tN_pad_mode handler)
- Modify: `dsp/seq8_set_param.c:2558-2565` (convert_to_drum/melodic handlers)
- Modify: `dsp/seq8_set_param.c:898` (Clear Session pad_mode reset)

- [ ] **Step 1: Update drum_track_init — no allocation, just NULL pointers**

At `dsp/seq8.c:5701`:

```c
static void drum_track_init(seq8_track_t *tr, int track_idx) {
    int c, l;
    for (c = 0; c < NUM_CLIPS; c++)
        tr->drum_clips[c] = NULL;
    for (l = 0; l < DRUM_LANES; l++) {
        tr->drum_rec_pending_tick[l]   = 0;
        tr->drum_rec_pending_step[l]   = 0;
        tr->drum_rec_pending_active[l] = 0;
        tr->drum_last_rec_step[l]      = -1;
        drum_pfx_init_defaults(&tr->drum_lane_pfx[l], (uint8_t)track_idx, (uint8_t)l);
    }
    tr->active_drum_lane  = 0;
    tr->drum_perform_mode = 0;
}
```

- [ ] **Step 2: Allocate after state load sets pad_mode to DRUM**

In `seq8_load_state` (`dsp/seq8.c`), the pad_mode is loaded at line ~1764:
```c
inst->tracks[t].pad_mode = (uint8_t)clamp_i(json_get_int(buf, key, 0), 0, 1);
```

Immediately after this line (still inside the per-track loop), add:
```c
if (inst->tracks[t].pad_mode == PAD_MODE_DRUM)
    drum_clips_alloc(inst, &inst->tracks[t]);
```

This must happen BEFORE the drum lane data loading loop (line ~2014) which reads `drum_clips[c].lanes[l]`.

- [ ] **Step 3: Update tN_pad_mode handler**

At `dsp/seq8_set_param.c:2550`:

```c
/* Before: */
if (!strcmp(sub, "pad_mode")) {
    tr->pad_mode = (uint8_t)clamp_i(my_atoi(val), 0, 1);
    tarp_silence(inst, tr); /* silence tarp when switching to drum mode */
    return;
}

/* After: */
if (!strcmp(sub, "pad_mode")) {
    uint8_t new_mode = (uint8_t)clamp_i(my_atoi(val), 0, 1);
    if (new_mode == PAD_MODE_DRUM && tr->pad_mode != PAD_MODE_DRUM)
        drum_clips_alloc(inst, tr);
    else if (new_mode != PAD_MODE_DRUM && tr->pad_mode == PAD_MODE_DRUM)
        drum_clips_free(tr);
    tr->pad_mode = new_mode;
    tarp_silence(inst, tr);
    return;
}
```

- [ ] **Step 4: Update convert_to_drum / convert_to_melodic**

`convert_track_melodic_to_drum` (seq8.c:7957) already sets `pad_mode` internally. Add `drum_clips_alloc` at the top, before the conversion loop:

```c
static void convert_track_melodic_to_drum(seq8_instance_t *inst, int t) {
    seq8_track_t *tr = &inst->tracks[t];
    /* ... existing disarm code ... */
    drum_clips_alloc(inst, tr);  /* ensure clips exist before writing */
    /* ... rest of function unchanged ... */
}
```

`convert_track_drum_to_melodic` (seq8.c:8072) clears drum lanes at the end then sets `pad_mode = PAD_MODE_MELODIC_SCALE`. Add `drum_clips_free` after the conversion:

At the end of `convert_track_drum_to_melodic`, after `tr->pad_mode = PAD_MODE_MELODIC_SCALE;` (line ~8128), add:
```c
drum_clips_free(tr);
```

But wait — the function body reads from `dc->lanes[l]` during conversion (lines 8083-8125). The clips must exist during conversion and be freed AFTER. So the free goes after the pad_mode assignment, which is after the conversion loop. Correct.

- [ ] **Step 5: Update state_load handler — free before reset (CRITICAL)**

The `state_load` handler (seq8_set_param.c:856) runs on a **live** instance (set switch, resume UUID mismatch). It resets all tracks to MELODIC (line 898) then calls `drum_track_init` (line 923) which NULLs the pointers. Without freeing first, the old set's malloc'd clips leak.

Add `drum_clips_free(tr2)` BEFORE `drum_track_init` in the state_load handler's per-track reset loop. Insert at line ~923, before the existing `drum_track_init` call:

```c
/* Before: */
drum_track_init(tr2, t2);

/* After: */
drum_clips_free(tr2);  /* free old set's drum clips before NULLing pointers */
drum_track_init(tr2, t2);
```

This is safe: `drum_clips_free` is idempotent (skips NULL pointers), so on first load from `create_instance` (where pointers start as NULL from calloc) it's a no-op.

- [ ] **Step 6: Update Clear Session**

At `dsp/seq8_set_param.c:898`, the Clear Session handler resets `pad_mode` to `PAD_MODE_MELODIC_SCALE` then calls `drum_track_init` at line 923 (same code path as state_load — they share the reset block). The `drum_clips_free` added in Step 5 covers Clear Session too since it's the same code path.

- [ ] **Step 7: Update destroy_instance**

At `dsp/seq8.c:6109` (`destroy_instance`), free all drum clips before `free(inst)`:

```c
static void destroy_instance(void *instance) {
    seq8_instance_t *inst = (seq8_instance_t *)instance;
    /* ... existing cleanup ... */
    int t;
    for (t = 0; t < NUM_TRACKS; t++)
        drum_clips_free(&inst->tracks[t]);
    /* ... existing free(inst) ... */
}
```

- [ ] **Step 8: Commit**

```bash
git add dsp/seq8.c dsp/seq8_set_param.c
git commit -m "feat: wire drum clip alloc into mode-switch lifecycle

Allocate on: state load (drum tracks), tN_pad_mode=DRUM, convert_to_drum.
Free on: state_load reset, tN_pad_mode=MELODIC, convert_to_melodic, destroy.
Critical: drum_clips_free before drum_track_init in state_load handler to
prevent leak on set-switch / resume UUID mismatch."
```

---

### Task 3: Convert seq8.c access sites (`.` → `->`, add NULL guards)

**Files:**
- Modify: `dsp/seq8.c` (~75 access sites)

**Strategy:** Every `tr->drum_clips[c].lanes` becomes `tr->drum_clips[c]->lanes`. For functions that only run on drum-mode tracks (most of them), the pointer is guaranteed non-NULL because allocation happened at mode switch. For functions that iterate all tracks unconditionally, add a NULL guard.

- [ ] **Step 1: Categorize — which sites need NULL guards vs. just `->` conversion**

**No NULL guard needed** (only runs on drum-mode tracks, guaranteed allocated):
- `render_drum_lane_nd` (7599) — called only during drum render
- `bake_drum_lane` (7438) — called only on drum tracks
- `bake_drum_clip` (7722) — called only on drum tracks
- `drum_lane_note_off_imm` (4164) — drum-mode pitch scan
- `drum_repeat_*` functions — drum-only
- `convert_track_melodic_to_drum` (7957) — allocates first (Task 2)
- `convert_track_drum_to_melodic` (8072) — runs while still in drum mode
- `undo_begin_drum_clip` (6649) — only on drum tracks

**NULL guard needed** (iterates all tracks or may run on melodic tracks):
- `track_is_empty` (7938) — iterates all tracks' drum clips
- `drum_row_snap` (6503) — iterates all tracks' drum clips at a row
- `drum_row_restore` (6531) — iterates all tracks
- `seq8_save_state` drum section (1403) — iterates all tracks (already guards on `pad_mode == PAD_MODE_DRUM`, so pointer is guaranteed — just needs `->`)
- `state_load` drum section (2014) — already guards on `pad_mode != PAD_MODE_DRUM`; allocated in Task 2 step 2
- Loop cycle reset (9074) — iterates all tracks
- Log line sizeof (6100) — uses `sizeof(drum_clip_t)`, no pointer change needed

- [ ] **Step 2: Bulk convert `.` to `->` in seq8.c**

Every occurrence of pattern `drum_clips[X].lanes` → `drum_clips[X]->lanes`. Also `drum_clips[X].` without `.lanes` if any exist (none expected — `drum_clip_t` only contains `lanes[]`).

This is a mechanical find-and-replace. Enumerate all sites:

Lines (approximate) in seq8.c that need `.` → `->`:
```
1409, 2019, 2156, 2246-2265,
4167, 4842, 4866, 4987, 5002, 5059,
5546, 5705, 6298, 6313, 6430, 6434,
6509, 6537, 6654,
7441, 7453, 7578, 7605, 7727, 7746, 7773,
7896, 7911, 7921, 7944, 7970-7976,
8025, 8038, 8042-8043, 8054,
8083, 8091-8094, 8107, 8122-8124,
8473, 8523, 8723, 8787, 8809,
9074, 9223, 9303, 9452, 9583, 9622, 9651, 9683, 9909
```

For each, change `tr->drum_clips[c].lanes[l]` → `tr->drum_clips[c]->lanes[l]` (or similar with `dc->lanes[l]` where `dc` was `&tr->drum_clips[c]` and now becomes `tr->drum_clips[c]`).

Also, local variables that took the address need updating:
```c
/* Before: */
drum_clip_t *dc = &tr->drum_clips[c];

/* After: */
drum_clip_t *dc = tr->drum_clips[c];
```

- [ ] **Step 3: Add NULL guards for cross-track iteration sites**

**`track_is_empty` (7938):**
```c
/* Before: */
for (c = 0; c < NUM_CLIPS; c++)
    for (l = 0; l < DRUM_LANES; l++)
        if (tr->drum_clips[c].lanes[l].clip.note_count > 0) return 0;

/* After: */
for (c = 0; c < NUM_CLIPS; c++) {
    if (!tr->drum_clips[c]) continue;
    for (l = 0; l < DRUM_LANES; l++)
        if (tr->drum_clips[c]->lanes[l].clip.note_count > 0) return 0;
}
```

**`drum_row_snap` (6503):**
```c
/* After: add NULL guard per track */
for (t = 0; t < NUM_TRACKS; t++) {
    drum_clip_t *dc = inst->tracks[t].drum_clips[row];
    if (!dc) {
        /* Snapshot as empty — zero the snap slot */
        memset(&dst[t], 0, sizeof(drum_rec_snap_lane_t) * DRUM_LANES);
        continue;
    }
    for (l = 0; l < DRUM_LANES; l++) {
        /* ... existing memcpy code, unchanged ... */
    }
}
```

**`drum_row_restore` (6531):**
```c
/* After: handle alloc/free per track based on snapshot content */
for (t = 0; t < NUM_TRACKS; t++) {
    /* Check if snapshot has any data for this track */
    int snap_has_data = 0;
    for (l = 0; l < DRUM_LANES; l++) {
        if (src[t][l].active) { snap_has_data = 1; break; }
    }

    drum_clip_t *dc = inst->tracks[t].drum_clips[row];

    if (!snap_has_data) {
        /* Restoring empty snapshot — free clip if allocated */
        if (dc) {
            free(dc);
            inst->tracks[t].drum_clips[row] = NULL;
        }
        continue;
    }

    /* Restoring non-empty snapshot — allocate if needed */
    if (!dc) {
        dc = (drum_clip_t *)calloc(1, sizeof(drum_clip_t));
        if (!dc) continue;
        inst->tracks[t].drum_clips[row] = dc;
        for (l = 0; l < DRUM_LANES; l++) {
            clip_init(&dc->lanes[l].clip);
            drum_pfx_params_init(&dc->lanes[l].pfx_params);
            dc->lanes[l].midi_note = (uint8_t)(DRUM_BASE_NOTE + l);
        }
    }

    for (l = 0; l < DRUM_LANES; l++) {
        /* ... existing memcpy code, unchanged ... */
    }
}
```

**Loop cycle reset (9074):**
```c
/* Before: */
inst->tracks[t].drum_clips[c].lanes[l].clip.loop_cycle = 0;

/* After: */
if (inst->tracks[t].drum_clips[c])
    inst->tracks[t].drum_clips[c]->lanes[l].clip.loop_cycle = 0;
```

- [ ] **Step 4: Compile and fix remaining errors**

```bash
./scripts/build.sh 2>&1 | grep 'error:' | head -40
```

Iterate until clean.

- [ ] **Step 5: Commit**

```bash
git add dsp/seq8.c
git commit -m "refactor: convert seq8.c drum_clips access — pointer deref + NULL guards

~75 access sites converted from .lanes to ->lanes. NULL guards added for
track_is_empty, drum_row_snap, drum_row_restore (with alloc/free on restore),
and loop_cycle reset."
```

---

### Task 4: Convert seq8_set_param.c access sites

**Files:**
- Modify: `dsp/seq8_set_param.c` (~70 access sites)

- [ ] **Step 1: Bulk `.` → `->` conversion**

Same mechanical change as Task 3. All `&tr->drum_clips[c]` → `tr->drum_clips[c]`, all `.lanes` → `->lanes`.

Key sites in seq8_set_param.c (approximate lines):
```
1285-1304 (copy_to drum), 1416-1437 (cut drum), 1464-1484 (reassign drum),
1516-1542 (swap drum), 1597-1600 (clear drum), 1615-1639 (undo/redo drum),
1726-1752 (redo drum), 2435-2469 (step param writes),
4201-4202 (quantize), 4215-4300 (various drum lane params),
4429-4652 (step params), 4901-4904 (pad step toggle),
5021-5024 (multi-step toggle)
```

- [ ] **Step 2: Handle undo/redo capture + restore for NULL clips**

**Undo capture** (seq8_set_param.c ~1614, `undo_begin_drum_clip`):
```c
/* dc may be NULL for melodic tracks — but undo_begin_drum_clip is only called
 * on drum tracks where clips are guaranteed allocated. No NULL guard needed,
 * just the -> conversion. */
drum_clip_t *dc = inst->tracks[t].drum_clips[c];  /* was &... */
```

**Undo restore** (seq8_set_param.c ~1638):
The undo restore writes back into `dc->lanes[i]`. The clip was allocated when the snapshot was taken (undo_begin only fires on drum tracks). If someone switched the track to melodic between taking the snapshot and undoing... that shouldn't happen (undo is per-track, mode switch would invalidate undo). But defensively:

```c
/* Restore */
drum_clip_t *dc = inst->tracks[t].drum_clips[c];
if (!dc) {
    dc = (drum_clip_t *)calloc(1, sizeof(drum_clip_t));
    if (!dc) return;
    inst->tracks[t].drum_clips[c] = dc;
    int _li;
    for (_li = 0; _li < DRUM_LANES; _li++) {
        clip_init(&dc->lanes[_li].clip);
        drum_pfx_params_init(&dc->lanes[_li].pfx_params);
        dc->lanes[_li].midi_note = (uint8_t)(DRUM_BASE_NOTE + _li);
    }
}
for (i = 0; i < DRUM_LANES; i++) {
    drum_lane_t *lane = &dc->lanes[i];
    /* ... existing restore code ... */
}
```

Same pattern for redo restore (~1752).

**Row undo/redo** (seq8_set_param.c ~1695-1808):
These call `drum_row_snap` and `drum_row_restore` which are handled in Task 3 Step 3.

- [ ] **Step 3: Handle clip copy/cut/clear — allocation for destination, free for clear**

**Copy-to drum** (~1285): Destination needs allocation:
```c
drum_clip_t *ddst = drum_clip_ensure(inst, &inst->tracks[dst_track], dst_clip);
if (!ddst) return;
drum_clip_t *dsrc = inst->tracks[src_track].drum_clips[src_clip];
if (!dsrc) { /* source empty — clear destination */
    /* ... init all lanes in ddst ... */
    return;
}
```

Actually, simpler: if source is NULL, the copy is a no-op (nothing to copy). If destination needs to exist, allocate it:

```c
drum_clip_t *dsrc = inst->tracks[src_track].drum_clips[src_clip];
if (!dsrc) return;  /* nothing to copy */
drum_clip_t *ddst = inst->tracks[dst_track].drum_clips[dst_clip];
if (!ddst) {
    ddst = (drum_clip_t *)calloc(1, sizeof(drum_clip_t));
    if (!ddst) return;
    inst->tracks[dst_track].drum_clips[dst_clip] = ddst;
    int _li;
    for (_li = 0; _li < DRUM_LANES; _li++) {
        clip_init(&ddst->lanes[_li].clip);
        drum_pfx_params_init(&ddst->lanes[_li].pfx_params);
        ddst->lanes[_li].midi_note = (uint8_t)(DRUM_BASE_NOTE + _li);
    }
}
```

**Cut drum** (~1416): Source and destination. After cut, source gets cleared but NOT freed (still a drum track, might get data again).

**Clear drum** (~1597): Re-init lanes but do NOT free the clip (track is still in drum mode):
```c
drum_clip_t *dc = inst->tracks[t].drum_clips[c];
if (!dc) return;
for (l = 0; l < DRUM_LANES; l++) {
    uint8_t midi_note = dc->lanes[l].midi_note;
    clip_init(&dc->lanes[l].clip);
    dc->lanes[l].midi_note = midi_note;
}
```

- [ ] **Step 4: Compile and fix remaining errors**

```bash
./scripts/build.sh 2>&1 | grep 'error:' | head -40
```

Iterate until clean.

- [ ] **Step 5: Commit**

```bash
git add dsp/seq8_set_param.c
git commit -m "refactor: convert seq8_set_param.c drum_clips access sites

~70 access sites converted. Undo/redo restore allocates clip if needed.
Copy/cut destination allocates on demand. Clear re-inits without freeing."
```

---

### Task 5: Update init log + final compile verification

**Files:**
- Modify: `dsp/seq8.c:6097-6104` (init log)

- [ ] **Step 1: Update init log to report drum allocation**

```c
/* Count allocated drum clips */
int _dc_count = 0;
{ int _t, _c;
  for (_t = 0; _t < NUM_TRACKS; _t++)
    for (_c = 0; _c < NUM_CLIPS; _c++)
      if (inst->tracks[_t].drum_clips[_c]) _dc_count++;
}
snprintf(szlog, sizeof(szlog),
         "SEQ8 init: inst=%zu track=%zu drum_alloc=%d/128 bpm=%.1f",
         sizeof(seq8_instance_t), sizeof(seq8_track_t),
         _dc_count, inst->tracks[0].pfx.cached_bpm);
```

- [ ] **Step 2: Full clean build**

```bash
./scripts/build.sh
nm -D dist/davebox/dsp.so | grep GLIBC  # verify ≤ 2.35
```

- [ ] **Step 3: Commit**

```bash
git add dsp/seq8.c
git commit -m "fix: update init log to report drum clip allocation count"
```

---

### Task 6: Deploy + device verification

**Files:** None (verification only)

- [ ] **Step 1: Deploy to Move**

```bash
./scripts/install.sh
```

Reboot Move:
```bash
ssh root@move.local "for name in MoveOriginal Move MoveLauncher MoveMessageDisplay shadow_ui schwung link-subscriber display-server schwung-manager; do pids=\$(pidof \$name 2>/dev/null || true); [ -n \"\$pids\" ] && kill -9 \$pids 2>/dev/null || true; done && /etc/init.d/move start >/dev/null 2>&1"
```

- [ ] **Step 2: Verify init log**

```bash
ssh ableton@move.local "tail -5 /data/UserData/schwung/seq8.log"
```

Expect `drum_alloc=16/128` (1 default drum track × 16 clips) or similar.

- [ ] **Step 3: Device test matrix**

Test each operation on a drum track. Check `seq8.log` after each for crashes/warnings:

**Basic drum operations:**
1. Load dAVEBOx → drum track → tap pads → step-enter notes → verify playback
2. Toggle steps on/off, change velocity, change gate length
3. Arm recording, play pads, stop → verify notes captured

**Clip operations:**
4. Copy clip 1 → paste to clip 2 → verify identical
5. Cut clip → verify source empty, destination has data
6. Clear a clip with data → verify empty

**Undo/redo:**
7. Record some notes → undo → verify restored → redo → verify re-applied
8. Row copy → undo → verify
9. Row cut → undo → verify (bidirectional alloc/free path)

**Cross-track:**
10. Bake a drum clip with pfx → verify output
11. Export to Ableton → verify drum tracks included

**State persistence:**
12. Quit module → re-enter → verify all drum data preserved
13. Check `drum_alloc` in log matches expected count

**Mode switching (allocation trigger):**
14. Switch a melodic track to drum → enter notes → verify works
15. Switch that drum track back to melodic → verify notes converted
16. Switch back to drum → verify clean state
17. Verify `drum_alloc` changes in log with each switch

**Clear Session:**
18. Clear all → verify everything wiped
19. Check `drum_alloc=16/128` after clear (just default t0)

**State reload on live instance (CRITICAL — leak/corruption path):**
20. Save a set with drum data → switch to a different set (triggers state_load on live instance) → switch back → verify drum data intact
21. Save a set with 2 drum tracks → switch to a set with 0 drum tracks → check `drum_alloc=0/128` in log (no leak)
22. Save a set with a drum track → modify set so that track is melodic → reload → verify no stale drum data bleeds through

**Edge cases:**
23. Melodic→drum conversion on track with notes → verify pitch→lane mapping
24. Multiple drum tracks (2-3) → verify all work independently

- [ ] **Step 4: Verify memory reduction**

```bash
ssh ableton@move.local "cat /proc/\$(pidof schwung)/status | grep VmRSS"
```

Compare with a known baseline. Expect ~50MB less RSS with default 1-drum-track config.

---

### Task 7: Documentation updates

**Files:**
- Modify: `CHANGELOG.md`
- Modify: `notes/TODO.md`
- Modify: `dsp/CLAUDE.md`

- [ ] **Step 1: Add changelog entry**

Under `[Unreleased]` → `### Performance / UX`:

```markdown
- **Lazy drum clip allocation** — drum clips are now allocated per-track on drum mode entry instead of inline in every track. Default (1 drum track): ~7.5MB vs 60MB previously. No cap, no behavioral change.
```

- [ ] **Step 2: Mark TODO item done**

In `notes/TODO.md`, update the "Lazy-allocate drum lanes" entry to show it's shipped, with approach note (per-block, per-track allocation).

- [ ] **Step 3: Update dsp/CLAUDE.md**

Add after the "State format" section:

```markdown
## Drum clip allocation

`drum_clip_t *drum_clips[16]` — pointers, NULL when track is in melodic mode. All 16 allocated via `drum_clips_alloc(inst, tr)` on drum-mode entry (pad_mode switch, convert_to_drum, state load). Freed via `drum_clips_free(tr)` on melodic-mode entry. No malloc on audio thread — allocation is on user-initiated mode switch only. Inner lane loops (`for l in 0..DRUM_LANES`) unchanged; all 32 lanes always exist within an allocated clip.
```

- [ ] **Step 4: Commit**

```bash
git add CHANGELOG.md notes/TODO.md dsp/CLAUDE.md
git commit -m "docs: changelog + TODO + DSP docs for drum clip lazy allocation"
```
