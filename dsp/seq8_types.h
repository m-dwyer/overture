/*
 * SEQ8 data model types.
 *
 * Phase 2 starts with the smallest shared transport type, then moves larger
 * pure data structs here in mechanical slices.
 */
#ifndef SEQ8_TYPES_H
#define SEQ8_TYPES_H

#include <stdint.h>
#include "seq8_constants.h"

typedef struct {
    uint8_t s;
    uint8_t d1;
    uint8_t d2;
} ext_msg_t;

typedef struct {
    uint64_t fire_at;
    uint8_t  msg[3];
    uint8_t  flags;
} pfx_event_t;

typedef struct {
    uint8_t  active;
    uint8_t  channel;
    uint64_t on_time;
    uint64_t gate_override_smp;
    uint8_t  orig_velocity;
    uint8_t  gen_notes[MAX_GEN_NOTES];
    int      gen_count;
    double   spc;
    int      stored_repeat_count;
    struct {
        uint64_t cumul_delay;
        int8_t   pitch_offset;
        uint8_t  velocity;
        double   gate_factor;
    } reps[MAX_REPEATS];
} pfx_active_t;

typedef struct {
    uint32_t tick;
    uint16_t gate;
    uint8_t  pitch;
    uint8_t  vel;
    uint8_t  active;
    uint8_t  suppress_until_wrap;
    uint8_t  pad[2];
} note_t;

typedef struct {
    uint16_t count[8];
    uint16_t ticks[8][CC_AUTO_MAX_POINTS];
    uint8_t  vals[8][CC_AUTO_MAX_POINTS];
    uint8_t  rest_val[8];
    uint16_t lane_loop_start[8];
    uint16_t lane_length[8];
    uint16_t lane_tps[8];
    uint16_t lane_res_tps[8];
} cc_auto_t;

typedef struct {
    uint8_t  pitch[AT_MAX_LANES];
    uint16_t count[AT_MAX_LANES];
    uint16_t ticks[AT_MAX_LANES][AT_MAX_POINTS];
    uint8_t  vals [AT_MAX_LANES][AT_MAX_POINTS];
} at_auto_t;

typedef struct {
    uint8_t  style;
    uint8_t  rate_idx;
    int8_t   octaves;
    uint16_t gate_pct;
    uint8_t  steps_mode;
    uint8_t  retrigger;
    uint8_t  step_vel[8];
    int8_t   step_int[8];
    uint8_t  step_loop_len;
    uint32_t master_anchor;

    uint8_t  held_pitch[ARP_MAX_HELD];
    uint8_t  held_vel[ARP_MAX_HELD];
    uint8_t  held_order[ARP_MAX_HELD];
    uint8_t  held_physical[ARP_MAX_HELD];
    uint8_t  held_count;
    uint8_t  next_order;

    int16_t  cyc_pos;
    int8_t   ud_dir;
    uint16_t cycle_step_count;
    uint64_t random_used;

    uint8_t  step_pos;

    int32_t  ticks_until_next;
    uint8_t  pending_first_note;
    uint8_t  pending_retrigger;

    uint8_t  sounding_active;
    uint8_t  sounding_pitch;
    uint32_t gate_remaining;

    uint16_t fire_count;
} arp_engine_t;

typedef struct {
    int octave_shift;
    int note_offset;
    int gate_time;
    int velocity_offset;
    int quantize;
    int octaver;
    int harmonize_1;
    int harmonize_2;
    int harmonize_3;
    int delay_time_idx;
    int delay_level;
    int repeat_times;
    int fb_velocity;
    int fb_note;
    int fb_note_random;
    int fb_note_random_mode;
    int fb_gate_time;
    int fb_clock;
    int delay_retrig;
    int note_random;
    int note_random_mode;
    int note_random_walk;
    arp_engine_t arp;
    uint8_t      arp_emitting;
    uint8_t      seq_arp_sync;
    uint64_t     sample_counter;
    double       cached_bpm;
    uint32_t     rng;
    pfx_event_t  events[MAX_PFX_EVENTS];
    int          event_count;
    pfx_active_t active_notes[128];
    uint8_t      route;
    uint8_t      looper_on;
    uint8_t      track_idx;
    uint8_t      pitch_refcount[128];
} play_fx_t;

typedef struct {
    int octave_shift;
    int note_offset;
    int gate_time;
    int velocity_offset;
    int quantize;
    int octaver;
    int harmonize_1;
    int harmonize_2;
    int harmonize_3;
    int delay_time_idx;
    int delay_level;
    int repeat_times;
    int fb_velocity;
    int fb_note;
    int fb_note_random;
    int fb_note_random_mode;
    int fb_gate_time;
    int fb_clock;
    int delay_retrig;
    int note_random;
    int note_random_mode;
    int seq_arp_style;
    int seq_arp_rate;
    int seq_arp_octaves;
    int seq_arp_gate;
    int seq_arp_steps_mode;
    int seq_arp_retrigger;
    int seq_arp_sync;
    uint8_t seq_arp_step_vel[8];
    int8_t  seq_arp_step_int[8];
    uint8_t seq_arp_step_loop_len;
    uint8_t note_length_mode;
} clip_pfx_params_t;

typedef struct {
    int gate_time;
    int velocity_offset;
    int quantize;
    int delay_time_idx;
    int delay_level;
    int repeat_times;
    int fb_velocity;
    int fb_gate_time;
    int fb_clock;
    int delay_retrig;
    uint8_t note_length_mode;
} drum_pfx_params_t;

typedef struct {
    int gate_time;
    int velocity_offset;
    int quantize;
    int delay_time_idx;
    int delay_level;
    int repeat_times;
    int fb_velocity;
    int fb_gate_time;
    int fb_clock;
    int delay_retrig;
    uint64_t     sample_counter;
    double       cached_bpm;
    uint32_t     rng;
    pfx_event_t  events[DRUM_PFX_MAX_EVENTS];
    int          event_count;
    pfx_active_t active_note;
    uint8_t      route;
    uint8_t      looper_on;
    uint8_t      track_idx;
    uint8_t      lane_idx;
} drum_pfx_t;

typedef struct {
    uint8_t  steps[SEQ_STEPS];
    uint8_t  step_notes[SEQ_STEPS][8];
    uint8_t  step_note_count[SEQ_STEPS];
    uint8_t  step_vel[SEQ_STEPS];
    uint16_t step_gate[SEQ_STEPS];
    int16_t  note_tick_offset[SEQ_STEPS][8];
    uint8_t  step_iter[SEQ_STEPS];
    uint8_t  step_random[SEQ_STEPS];
    uint8_t  step_ratchet[SEQ_STEPS];
    uint16_t loop_cycle;
    uint16_t length;
    uint16_t loop_start;
    uint8_t  active;
    uint16_t clock_shift_pos;
    int8_t   stretch_exp;
    int16_t  nudge_pos;
    uint16_t ticks_per_step;
    clip_pfx_params_t pfx_params;
    note_t   notes[MAX_NOTES_PER_CLIP];
    uint16_t note_count;
    uint8_t  occ_cache[32];
    uint8_t  occ_dirty;
    uint8_t  playback_dir;
    uint8_t  playback_audio_reverse;
    int8_t   pp_dir_state;
} clip_t;

typedef struct {
    clip_t  clip;
    drum_pfx_params_t pfx_params;
    uint8_t midi_note;
    uint8_t _pad[3];
} drum_lane_t;

typedef struct {
    drum_lane_t lanes[DRUM_LANES];
} drum_clip_t;

typedef struct {
    uint8_t  steps[SEQ_STEPS];
    uint8_t  step_notes[SEQ_STEPS][8];
    uint8_t  step_note_count[SEQ_STEPS];
    uint8_t  step_vel[SEQ_STEPS];
    uint16_t step_gate[SEQ_STEPS];
    int16_t  note_tick_offset[SEQ_STEPS][8];
    uint8_t  step_iter[SEQ_STEPS];
    uint8_t  step_random[SEQ_STEPS];
    uint8_t  step_ratchet[SEQ_STEPS];
    uint16_t length;
    uint16_t loop_start;
    uint8_t  active;
    uint8_t  playback_dir;
    uint8_t  playback_audio_reverse;
    drum_pfx_params_t pfx_params;
} drum_rec_snap_lane_t;

typedef struct {
    uint8_t   channel;              /* MIDI channel 0-3 */
    clip_t    clips[NUM_CLIPS];
    uint8_t   active_clip;          /* clip currently active */
    int8_t    queued_clip;          /* next clip to launch at bar boundary (-1 = none) */
    uint16_t  current_step;
    uint8_t   note_active;
    /* Per-note deferred dispatch: notes with positive tick_offset fired mid-step */
    uint8_t   step_dispatch_mask;       /* bit N set = note index N not yet fired this step */
    uint8_t   step_dispatch_tick[8];    /* tick_in_step to fire each pending note */
    /* Lookahead: notes of the NEXT step already fired early (negative offset) */
    uint8_t   next_early_mask;          /* bit N set = note N of next step fired early */
    uint16_t  pending_gate;             /* effective gate stored at note-on */
    uint16_t  gate_ticks_remaining;     /* countdown to note-off; decrements every tick */
    uint8_t   pending_notes[8];         /* notes fired at note-on; matched at note-off */
    uint8_t   pending_note_count;       /* how many entries in pending_notes are valid */
    play_fx_t pfx;
    uint8_t   pad_octave;           /* live pad root octave (0-8, default 3) */
    uint8_t   pad_mode;             /* PAD_MODE_MELODIC_SCALE = 0 */
    uint8_t   stretch_blocked;      /* 1 if last compress was blocked by collision */
    uint8_t   recording;            /* 1 = actively recording (overdub) into active clip */
    uint8_t   clip_playing;         /* 1 = clip is actively running */
    uint8_t   will_relaunch;        /* 1 = was playing; restarts when transport plays */
    uint8_t   pending_page_stop;    /* 1 = stop at next main clock bar boundary (global_tick%16==0) */
    uint8_t   record_armed;         /* 1 = set recording=1 atomically when queued clip launches */
    uint8_t   recording_pending_page; /* 1 = set recording=1 at next bar boundary (global_tick%16==0) */
    uint8_t   recording_adaptive_arm; /* 1 = at recording_pending_page fire, reset playhead to loop_start
                                       *     (adaptive-mode arms only — fixed-mode records mid-page) */
    /* Steps recorded in the current recording pass; cleared on clip wrap so they play
     * back starting from the next loop (not the pass they were recorded on). */
    uint8_t   live_recorded_steps[32]; /* 256-bit mask: 1 bit per step */
    /* Note-centric recording: in-flight note-ons awaiting note-off for gate capture */
    struct { uint8_t pitch; uint32_t tick_at_on; } rec_pending[10];
    uint8_t  rec_pending_count;
    /* Note-centric playback: per-note gate countdown (render state, not persisted) */
    struct { uint8_t pitch; uint16_t ticks_remaining; uint8_t lane_idx; uint8_t src_pitch; } play_pending[32];
    uint8_t  play_pending_count;
    /* v=34 Ratchet: deferred note-on schedule for step_ratchet sub-hits 1..r-1.
     * Each tick, ticks_until_fire decrements; at 0 the sub-hit fires (note-on +
     * push to play_pending for its own gate countdown) and the slot is dropped.
     * lane_idx = 0xFF means melodic track (calls pfx_note_on); else drum lane. */
    struct {
        uint8_t  pitch;
        uint8_t  vel;
        uint16_t ticks_until_fire;
        uint16_t gate;
        uint8_t  lane_idx;
    } ratchet_pending[24];
    uint8_t  ratchet_pending_count;
    /* Per-track tick position within current step; wraps at cl->ticks_per_step */
    uint32_t tick_in_step;
    /* Atomic render-state snapshot for set_param timing reads */
    uint32_t current_clip_tick;     /* current_step * TPS + tick_in_step; written each render tick */

    /* Drum mode: 16 clips, each containing 32 monophonic lanes.
     * Active when pad_mode == PAD_MODE_DRUM. active_clip/queued_clip/clip_playing
     * apply to drum_clips[] exactly as they do to clips[] in melodic mode. */
    drum_clip_t *drum_clips[NUM_CLIPS];
    /* Per-lane pfx runtime state (monophonic delay chains, not persisted as live runtime). */
    drum_pfx_t drum_lane_pfx[DRUM_LANES];
    /* Per-lane render-state tick counters (not persisted; reset on transport play/clip launch). */
    uint16_t drum_current_step[DRUM_LANES];
    uint32_t drum_tick_in_step[DRUM_LANES];
    /* Per-pass accumulation detector for Rpt1/Rpt2 recording: tracks the last
     * clip-step rs we wrote in this recording pass. -1 = none. On the first
     * fire of a new lane-step in a pass we obey the existing write-once gate;
     * on subsequent fires of the same lane-step (sub-step repeats) we
     * accumulate notes into the step with their sub-step offsets (InQ Off only). */
    int16_t  drum_last_rec_step[DRUM_LANES];
    /* Per-lane recording pending state (runtime only, not persisted). */
    uint32_t drum_rec_pending_tick[DRUM_LANES];
    uint16_t drum_rec_pending_step[DRUM_LANES];
    uint8_t  drum_rec_pending_active[DRUM_LANES];
    /* Per-lane mute/solo bitmasks (persisted). bit l = lane l. */
    uint32_t drum_lane_mute;
    uint32_t drum_lane_solo;
    /* TRACK ARP — per-track live arpeggiator, first stage of pfx chain.
     * Intercepts live pad + external MIDI note-on/off only; sequenced notes
     * bypass tarp and enter pfx_note_on directly. Bypassed on drum tracks. */
    arp_engine_t tarp;
    uint8_t      tarp_on;       /* K1: 0=bypassed, 1=enabled */
    uint8_t      tarp_latch;    /* K8: 0=release clears held, 1=latch keeps running */
    uint8_t      tarp_sync;     /* 0=free (fires immediately), 1=sync to next rate boundary */
    uint8_t      tarp_physical; /* runtime: physical keys currently held (not persisted) */
    /* Phase 1 / Bundle 2A: mirror of JS S.activeDrumLane[t]. JS pushes via
     * tN_active_drum_lane on every assignment site (8 in ui.js + init + sidecar
     * restore). on_midi reads it in drum_pad_event to fire the active lane's
     * note for vel-pad preview. Runtime, not persisted — JS sidecar owns
     * persistence for activeDrumLane. */
    uint8_t      active_drum_lane;
    /* Phase 1 / Bundle 2C-Rpt2: mirror of JS S.drumLanePage[t]. JS pushes
     * via tN_drum_lane_page on every page change (Up/Down arrow on drum
     * track + init + sidecar restore). on_midi reads it in drum_pad_event
     * to translate a left-half padIdx → absolute drum lane index (mirror
     * of JS drumPadToLane formula: page*16 + row*4 + col). Runtime, not
     * persisted. */
    uint8_t      drum_lane_page;
    /* Phase 1 / Bundle 2A: mirror of JS S.drumPerformMode[t] (0=NORMAL,
     * 1=Rpt1, 2=Rpt2). JS pushes via tN_drum_perform_mode whenever it
     * cycles (2 sites in ui.js). drum_pad_event reads this to decide
     * whether to fire vel-pad preview — Rpt modes use JS-side rate/lane
     * pad classification today (Bundle 2C will replace). Gating on this
     * mirror instead of drum_repeat_active fixes the first-hit double
     * trigger: drum_repeat_active flips AFTER the rate-pad set_param
     * processes, but mode is set BEFORE the user can press any rate pad,
     * so on_midi sees the right state. */
    uint8_t      drum_perform_mode;
    uint8_t      track_vel_override; /* TRACK K5: 0=Global, 1-127=absolute, 128=Live */
    /* Drum Repeat: gate mask, vel scale, nudge (per-lane, persisted) */
    uint8_t drum_repeat_gate[DRUM_LANES];         /* 8-step bitmask; bit s=step s; default 0xFF */
    uint8_t drum_repeat_gate_len[DRUM_LANES];     /* gate cycle length 1-8; default 8 */
    uint8_t drum_repeat_vel_scale[DRUM_LANES][8]; /* 0..200, default 100 */
    int8_t  drum_repeat_nudge[DRUM_LANES][8];     /* -50..50 pct, default 0 */
    /* Repeat engine (runtime, not persisted) */
    uint8_t  drum_repeat_active;
    uint8_t  drum_repeat_lane;
    uint8_t  drum_repeat_rate_idx;
    uint8_t  drum_repeat_vel;
    uint8_t  drum_repeat_step;
    uint32_t drum_repeat_phase;
    /* Phase 1 / Bundle 2C: latched-flag mirror for audio-thread unlatch detection.
     * JS owns the latch decision (engages on Loop-held press) and pushes
     * `tN_drum_repeat_latched 1` as a one-shot edge after start; the helper
     * `drum_repeat_start_internal` defensively clears this to 0 on every
     * start so JS only ever needs to push the 1-edge. drum_pad_event reads
     * this on rate-pad re-press to detect "unlatch tap" synchronously on
     * the audio thread, eliminating the JS-tick race that could otherwise
     * fire one extra repeat at fast rates. Stock Schwung: harmless flag
     * that nothing reads (drum_pad_event never reached). */
    uint8_t  drum_repeat_latched;
    /* Repeat 2 engine: multi-lane simultaneous repeat (runtime, not persisted) */
    uint32_t drum_repeat2_active;          /* bitmask: bit l = lane l held in Rpt 2 */
    uint8_t  drum_repeat2_rate_idx[DRUM_LANES]; /* per-lane rate index 0-7 */
    uint8_t  drum_repeat2_step[DRUM_LANES];     /* per-lane gate mask step 0-7 */
    uint32_t drum_repeat2_phase[DRUM_LANES];    /* per-lane phase within step */
    uint8_t  drum_repeat2_vel[DRUM_LANES];      /* per-lane velocity in Rpt 2 */
    /* Phase 1 / Bundle 2C-Rpt2: per-lane latched-flag bitmask. JS pushes
     * the 1-edge via tN_drum_repeat2_lane_latched <lane> 1 immediately
     * after a Loop-held lane-pad press; _lane_on_internal defensively
     * clears the lane's bit at entry so JS never needs to push the
     * 0-edge. drum_pad_event reads the bit to detect re-tap-to-unlatch
     * synchronously on the audio thread. */
    uint32_t drum_repeat2_latched_lanes;
    /* Per-track drum input quantize (persisted) */
    uint8_t  drum_inp_quant;    /* 0=Off, 1-8 = index into DRUM_INQ_TICKS */
    uint8_t  drum_repeat_sync;  /* 1=first fire snaps to rate grid via arp_master_tick; 0=instant. Per-track. */
    /* Pending sync flags (runtime, not persisted): repeat waits for InQ boundary */
    uint8_t  drum_repeat_pending;
    uint32_t drum_repeat2_pending;  /* bitmask: bit l = lane l pending InQ sync */
    /* CC PARAM bank (bank 6): per-track CC assignments for 8 knobs (persisted) */
    uint8_t  cc_assign[8];
    /* Per-knob continuous-modulation type: 0 = CC, 1 = Channel Pressure (aftertouch).
     * Per-track (persisted). cc_assign[k] is only used for type CC. */
    uint8_t  cc_type[8];
    /* Per-clip CC automation (melodic clips; persisted) */
    cc_auto_t clip_cc_auto[NUM_CLIPS];
    /* Per-clip pad-pressure aftertouch automation (melodic clips; persisted) */
    at_auto_t clip_at_auto[NUM_CLIPS];
    /* Last AT value sent per lane slot during playback; 0xFF = force resend.
     * Indexed by lane slot of the currently-playing clip; reset on play + clip change. */
    uint8_t   at_last_sent[AT_MAX_LANES];
    uint8_t   at_last_clip;   /* active_clip the at_last_sent[] cache reflects */
    /* Last CC value sent per knob during automation playback; 0xFF = force resend */
    uint8_t   cc_auto_last_sent[8];
    /* Defined output value at the playhead per knob (for the realtime display);
     * 0xFF = "—" (nothing defined here). Updated every tick in the playback path. */
    uint8_t   cc_auto_cur_val[8];
    /* block_count when each knob was last live-turned during recording (0 = never) */
    uint32_t  cc_auto_touch_frame[8];
    /* Touch-record: last live CC value per knob; bitmask of currently held knobs;
     * last 1/32 snap tick written per knob (0xFFFFFFFF = force write on next tick) */
    uint8_t   cc_live_val[8];
    uint8_t   cc_touch_held;
    uint8_t   _cc_touch_pad[3];
    uint32_t  cc_touch_last_snap[8];
    /* CC latch recording: a knob latches on first turn while record-armed and
     * thereafter overwrites the lane along the playhead with cc_live_val (one
     * point per 1/32) until recording stops. cc_latched = bitmask of latched
     * knobs; cc_latch_last_snap = last 1/32 tick written per knob; cc_prev_ct =
     * previous clip tick (loop-wrap detect for decimation); cc_was_recording =
     * previous-block recording flag (recording 1->0 edge → finalize+decimate). */
    uint8_t   cc_latched;
    uint8_t   cc_was_recording;
    uint32_t  cc_prev_ct;
    uint32_t  cc_latch_last_snap[8];
    /* Last poly-AT pressure value received via tN_live_at. Replayed on every
     * arp/TARP step so new voices spawn with the pressure currently being
     * applied (without this, holding pressure steady means no AT stream and
     * each new arp voice starts at 0). 0 = no replay (after release or fresh
     * track). Channel-pressure mode doesn't need this — the synth's channel
     * AT register holds the value. */
    uint8_t   last_poly_at_press;
} seq8_track_t;

#endif /* SEQ8_TYPES_H */
