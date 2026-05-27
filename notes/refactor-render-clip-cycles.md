# Refactor: unify the five clip-render copies

## Why

Five functions in `dsp/seq8.c` currently contain near-identical copies of the same render loop:

| # | Function | Line | Purpose | Destructive? | Pitch source |
|---|---|---|---|---|---|
| 1 | `bake_clip` | ~6706 | melodic bake (Capture) | yes (clip_init + write-back) | `pfx_build_gen_notes` (HARMZ/octaver/etc) |
| 2 | `bake_drum_lane` | ~6835 | single drum-lane bake | yes (clip_init lane) | `dl->midi_note` |
| 3 | `bake_drum_clip` | ~7073 | whole drum-clip bake | yes (clip_init all 32 lanes) | per-lane `dl->midi_note` |
| 4 | `render_melodic_clip` | ~6599 | melodic Ableton export | no (writes to `EXPORT_RENDER_PATH`) | `pfx_build_gen_notes` |
| 5 | `render_drum_lane_nd` | ~6980 | drum Ableton export | no (writes to file) | `dl->midi_note` |

Each one walks `cl->notes[]`, applies the same trig conditions (Iter + Random + Ratchet), runs the same pfx stages (NOTE FX, HARMZ, MIDI DLY, ARP), and emits the same `bake_note_t` shape. They differ on:

- **Pitch expansion** — melodic calls `pfx_build_gen_notes` for HARMZ; drum forces `dl->midi_note`
- **Wrap semantics** — bake has `wrap` flag (fold delay tail into top of clip on last cycle); export has `wrap_from` (cycle index where echoes start folding); drum-lane export uses `wrapped = (fx.delay_level > 0)` to fold per-cycle
- **Output destination** — bake writes back to `cl` (via `clip_init` + `clip_insert_note` + `clip_build_steps_from_notes`); export writes to a scratch buffer the caller then dumps to file
- **Loop count source** — bake takes user-set `loops` (1/2/4); melodic export takes `loops`; drum export computes per-lane `lane_loops = span / lane_clip_ticks` to fill the LCM span
- **Pool sizing** — `BAKE_BUF` for per-cycle scratch; `bake_out[BAKE_BUF * 4]` for melodic bake accumulator; `dc_pool[DRUM_BAKE_POOL]` for whole-drum-clip bake; export uses `drm_pool[DRUM_BAKE_POOL]`

This duplication has cost us real bugs. While shipping per-step trig conditions:
- Iter/Random/Ratchet had to be patched in 5 sites
- Missed `bake_drum_clip` and `render_drum_lane_nd` initially → device showed broken bakes/exports
- Long-standing `bake_drum_clip` length bug (used first-lane length instead of longest) only surfaced because of the trig-condition testing pass
- The `_copy_to` drum-lane handler missed `dst->clip.step_iter` memcpys (regex pattern didn't match the indirected shape) — silently truncated trigs on drum-lane copy

## Design — `render_clip_cycles`

Single shared function that owns the per-cycle render loop. Callers do their own setup/teardown.

```c
typedef enum {
    RENDER_MELODIC,   /* expand pitch via pfx_build_gen_notes (HARMZ chain) */
    RENDER_DRUM_LANE  /* force out pitch to caller-supplied note */
} render_mode_t;

typedef struct {
    render_mode_t mode;
    uint8_t       force_pitch;   /* drum: dl->midi_note; melodic: unused */
    int           loops;         /* >= 1 */
    /* Per-cycle MIDI DLY echo treatment:
     *   RENDER_WRAP_NONE  echoes past clip_ticks dropped (clean single pass)
     *   RENDER_WRAP_LAST  echoes generated full (UINT32_MAX) on last cycle only,
     *                     folded mod clip_ticks at accumulation time
     *   RENDER_WRAP_ALL   echoes folded into every cycle (steady-state) */
    uint8_t       wrap_mode;
} render_cycles_cfg_t;

/* Renders cfg->loops cycles of `cl` through the pfx chain into out[].
 * Honours v=34 trig conditions per-cycle (Iter gates by loop index, Random
 * rolls per-note, Ratchet expands to sub-hits). fx is initialised by the
 * caller with the right pfx params. Returns total notes written. */
static int render_clip_cycles(seq8_instance_t *inst, clip_t *cl,
                              play_fx_t *fx, const render_cycles_cfg_t *cfg,
                              bake_note_t *out, int out_cap);
```

### Inside `render_clip_cycles`

The body is essentially what's already in `bake_clip` + `bake_drum_lane`:

1. Compute `tps, length, clip_ticks, win_start_tick` from `cl`
2. For `loop = 0..cfg->loops - 1`:
   1. Build `stage_a[]` by walking `cl->notes[]`:
      - skip suppress_until_wrap, skip out-of-window
      - compute `_sidx = note_step(...)`, call `step_trig_pass(cl, _sidx, loop, &fx->rng)` — skip on fail
      - effective gate (`fx->gate_time`), effective vel (`fx->velocity_offset`), `bake_apply_quantize`
      - Expand pitches: `RENDER_MELODIC` → `pfx_build_gen_notes` loop; `RENDER_DRUM_LANE` → single entry with `cfg->force_pitch`
      - Ratchet expansion: r sub-hits at `tps / r` intervals, each gated to `tps / r`
   2. Pass `stage_a[]` through `BAKE_STAGES` (MIDI_DLY + ARP):
      - MIDI_DLY echo cap = `wrap_mode == RENDER_WRAP_LAST && loop == loops-1 ? UINT32_MAX : clip_ticks`
      - For `RENDER_WRAP_ALL` (drum lane export): always `UINT32_MAX`, fold per cycle
   3. Accumulate into `out[]` with `tick_offset = loop * clip_ticks`, applying the per-cycle wrap fold for `WRAP_ALL` / `WRAP_LAST`-on-last-cycle, or drop-past-clip for `WRAP_NONE`

### Caller adjustments

**`bake_clip`** (melodic): pre-setup unchanged (undo_begin_single, pfx_init_defaults+pfx_apply_params, fx.rng=DEADBEEF). Calls `render_clip_cycles` with `RENDER_MELODIC, wrap_mode = wrap ? RENDER_WRAP_LAST : RENDER_WRAP_NONE`. Post: `clip_init(cl)` → write notes via `clip_insert_note` → `clip_build_steps_from_notes` → `pfx_sync_from_clip` if active clip.

**`bake_drum_lane`**: same shape; drum-pfx init for `fx`, `RENDER_DRUM_LANE, force_pitch = dl->midi_note, wrap_mode = wrap ? RENDER_WRAP_LAST : RENDER_WRAP_NONE`. Post: clip_init lane, write notes, build steps, drum_pfx_params_init.

**`bake_drum_clip`**: loops over 32 lanes; for each non-empty lane calls `render_clip_cycles` with `lane_loops = new_ticks / clip_ticks` (existing fix, now in shared helper). Accumulate into `dc_pool[]` directly. Post: walk pool back into per-lane clips (existing post-loop logic).

**`render_melodic_clip`**: pre-setup unchanged; call `render_clip_cycles` with `RENDER_MELODIC, wrap_mode = wrap_from <= 0 ? RENDER_WRAP_ALL : RENDER_WRAP_LAST` (close enough — the existing `wrap_from` index is a single cutover; modelling it precisely needs a third mode or a `wrap_from_loop` field on the cfg). **Note:** if exact preservation of the `[0, wrap_from)` open / `[wrap_from, loops)` wrapped split matters, add `int wrap_from_loop` to cfg and let the helper switch per-cycle.

**`render_drum_lane_nd`**: pre-setup unchanged; call `render_clip_cycles` with `RENDER_DRUM_LANE, force_pitch = dl->midi_note, wrap_mode = fx.delay_level > 0 ? RENDER_WRAP_ALL : RENDER_WRAP_NONE, loops = caller-supplied`. The export caller (`_export_drum`) already computes `lane_loops` per lane and passes it in (recent change).

### Open questions for next session

1. **Wrap semantics modelling.** Three call-site behaviours to merge: `bake` (open all cycles, fold only on last when `wrap=1`), `render_melodic_clip` (open `[0, wrap_from)`, fold `[wrap_from, loops)`), `render_drum_lane_nd` (delay-on → fold every cycle). Cleanest mapping is probably the three-mode enum above plus a `wrap_from_loop` integer (defaults to `loops` = never), but worth a hands-on look at each call site to confirm before settling.

2. **`pfx_apply_params` vs drum_pfx struct-copy.** Melodic init uses `pfx_apply_params(&fx, &cl->pfx_params)`; drum init manually copies 10 fields from `drum_pfx_params_t` to `fx`. Caller still owns init, so the helper doesn't care — but worth noting that the drum-pfx → fx adapter is its own micro-duplication (3 copies: bake_drum_lane, bake_drum_clip, render_drum_lane_nd, and inline in `render_drum_lane_nd`'s `nd` rewrite). A small `drum_pfx_to_fx(fx, dp)` helper would clean that up.

3. **`bake_apply_quantize` placement.** Currently in the bake-side loop; should stay inside `render_clip_cycles` since trig conditions need to know the un-quantized sidx (via `note_step(nn->tick, ...)`). Confirm: quantize affects `eff_tick` only, not sidx → safe to compute both.

4. **`fx.rng` lifecycle.** Live render passes `&tr->pfx.rng` (or drum-lane pfx); bake/export init `fx.rng = 0xDEADBEEFu` locally so successive bakes of the same clip produce the same output (deterministic). The helper must accept the rng-owning fx and NOT reset it itself — preserve current behavior.

5. **`bake_out[BAKE_BUF * 4]` sizing.** Melodic bake's accumulator is sized for `BAKE_BUF * loops` (loops max 4). After refactor, if the helper writes directly into a caller-provided `out`, the caller sizes the buffer. Match existing capacities.

## Verification plan

Re-run the per-step trig + bake + export tests after the refactor (same matrix that uncovered the bugs this round):

1. **Live render** — Iter 1/2 alternates; Iter persists through clip switch; Iter resets on Stop→Play
2. **Live render** — Prob 50% on chord, voices flicker independently
3. **Live render** — Ratchet x2/x3/x4 each produces tight sub-hits within one step
4. **Bake melodic** — N=4 bake of clip with Iter 2/3 on step 1 → 4-cycle output, step 1 fires only on cycle 2
5. **Bake drum-lane** — same as #4 on a drum lane
6. **Bake drum-clip** — clip with mixed 8/16-step lanes bakes to longest_lane × loops length, shorter lanes loop in phase
7. **Bake drum-clip + trigs** — Iter / Prob / Ratch all captured into baked notes
8. **Melodic export** — `.ablbundle` notes match what device plays (trigs applied)
9. **Drum export** — same as #8 on drum clip; multi-cycle render resolves Iter

Edge cases:
- Empty clip → returns 0
- `loops = 0` → clamp to 1
- Chord overflow (4-note chord × ratchet x4 → 16 sub-hits per step, exceeds 8/step cap) → silent drop, log
- Drum-lane delay on (`delay_level > 0`) → `RENDER_WRAP_ALL` correctly folds echoes into each cycle

## Status at session close

- All 5 sites individually patched and device-verified for trig conditions
- Refactor is opportunistic cleanup, not blocking any user-visible feature
- ~1-2 hours focused work expected; sub-3 day at the outside if wrap-mode mapping needs iteration

Resume by reading this file and `git log --oneline -5` to confirm starting state, then proceed with `render_clip_cycles` extraction.
