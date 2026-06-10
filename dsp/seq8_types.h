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

#endif /* SEQ8_TYPES_H */
