/*
 * Compile-time layout guards for mechanical refactors.
 *
 * These assertions intentionally focus on pointer-free structs and stable
 * offsets so they pass on both aarch64 device builds and wasm32 emulator builds.
 * Do not update the numbers during a refactor unless the change is intentional
 * and state/runtime compatibility has been reviewed.
 */
#ifndef SEQ8_LAYOUT_ASSERTS_H
#define SEQ8_LAYOUT_ASSERTS_H

#include <stddef.h>
#include <stdint.h>

#define SEQ8_ASSERT_SIZE(type, expected) \
    _Static_assert(sizeof(type) == (expected), #type " size changed")

#define SEQ8_ASSERT_OFFSET(type, field, expected) \
    _Static_assert(offsetof(type, field) == (expected), #type "." #field " offset changed")

SEQ8_ASSERT_SIZE(ext_msg_t, 3);
SEQ8_ASSERT_SIZE(pfx_event_t, 16);
SEQ8_ASSERT_SIZE(pfx_active_t, 440);
SEQ8_ASSERT_SIZE(note_t, 12);
SEQ8_ASSERT_SIZE(cc_auto_t, 24664);
SEQ8_ASSERT_SIZE(at_auto_t, 18468);
SEQ8_ASSERT_SIZE(arp_engine_t, 136);
SEQ8_ASSERT_SIZE(play_fx_t, 60816);
SEQ8_ASSERT_SIZE(clip_pfx_params_t, 132);
SEQ8_ASSERT_SIZE(drum_pfx_params_t, 44);
SEQ8_ASSERT_SIZE(drum_pfx_t, 1544);

SEQ8_ASSERT_SIZE(clip_t, 14524);
SEQ8_ASSERT_SIZE(drum_lane_t, 14572);
SEQ8_ASSERT_SIZE(drum_clip_t, 466304);

SEQ8_ASSERT_OFFSET(play_fx_t, arp, 88);
SEQ8_ASSERT_OFFSET(play_fx_t, events, 256);
SEQ8_ASSERT_OFFSET(play_fx_t, active_notes, 4360);
SEQ8_ASSERT_OFFSET(clip_t, pfx_params, 8208);
SEQ8_ASSERT_OFFSET(clip_t, notes, 8340);
SEQ8_ASSERT_OFFSET(seq8_track_t, pfx, 232424);
#if UINTPTR_MAX == 0xffffffffu
SEQ8_ASSERT_OFFSET(seq8_track_t, drum_clips, 293764);
#else
SEQ8_ASSERT_OFFSET(seq8_track_t, drum_clips, 293768);
#endif

#undef SEQ8_ASSERT_SIZE
#undef SEQ8_ASSERT_OFFSET

#endif /* SEQ8_LAYOUT_ASSERTS_H */
