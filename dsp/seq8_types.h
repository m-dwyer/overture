/*
 * SEQ8 data model types.
 *
 * Phase 2 starts with the smallest shared transport type, then moves larger
 * pure data structs here in mechanical slices.
 */
#ifndef SEQ8_TYPES_H
#define SEQ8_TYPES_H

#include <stdint.h>

typedef struct {
    uint8_t s;
    uint8_t d1;
    uint8_t d2;
} ext_msg_t;

#endif /* SEQ8_TYPES_H */
