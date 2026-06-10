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

#endif /* SEQ8_TYPES_H */
