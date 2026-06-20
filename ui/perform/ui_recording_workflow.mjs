/**
 * Live-note recording sub-state, owned by the Recording Workflow concept
 * (held on the dedicated workflowState, not on `S`). Relocated here from
 * ui_live_note_workflow.mjs: it always belonged to this concept, and keeping it
 * here cuts the recording->live-note import edge so drum-recording producers
 * (incl. pad-surface, which live-note imports) can delegate to this module
 * without a no-circular violation.
 *
 * @typedef {Object} LiveNoteRecordingState
 * @property {Map<number, number>} recordingNoteTrack  pitch -> record realtime tick
 * @property {Map<number, { track: number, recording: boolean }>} extHeldNotes  external-MIDI held notes
 */

/** @returns {LiveNoteRecordingState} */
export function createLiveNoteRecordingState() {
    return {
        recordingNoteTrack: new Map(),
        extHeldNotes: new Map()
    };
}

/**
 * The Recording Workflow's dedicated state object (kept off `S` — the shape the
 * rest of `S`'s concepts are migrating toward).
 *
 * @typedef {Object} RecordingWorkflowState
 * @property {LiveNoteRecordingState} liveNoteRecordingState
 * @property {any[]} drumRecNoteOns   TODO: queued drum note-on descriptor
 * @property {any[]} drumRecNoteOffs
 */

/**
 * Host slice this module needs (Interface Segregation). The composition root in
 * ui.js structurally satisfies this; `State` is the shared contract (ui/types).
 *
 * @typedef {Object} RecordingDeps
 * @property {number} padModeDrum
 * @property {number} moveRec        REC button CC
 * @property {number} ledOff         "LED off" colour constant
 * @property {(key: string, val: string) => void} setParam
 * @property {(cc: number, color: number) => void} setButtonLED
 */

/* Recording-gate predicates. These name the recording concept's truth table so
 * handler modules stop open-coding `S.recordArmed && !S.recordCountingIn && …`.
 * Three deliberate variants exist; keep them distinct (see recording-predicates
 * test for the pinned truth table):
 *   - isActivelyRecordingTrack: armed, PAST count-in, t is the armed track. The
 *     canonical "this event records onto t" gate.
 *   - isArmedForTrack: armed for t INCLUDING count-in — pad capture accumulates
 *     pre-roll while the count-in is still running.
 *   - isActivelyRecording: armed and past count-in, ANY track — the tick flush
 *     gate and count-in-flash gate, which don't care which track is armed. */

/**
 * @param {import('../types').State} S
 * @param {number} t
 * @returns {boolean}
 */
export function isActivelyRecordingTrack(S, t) {
    return S.recordArmed && !S.recordCountingIn && S.recordArmedTrack === t;
}

/**
 * @param {import('../types').State} S
 * @param {number} t
 * @returns {boolean}
 */
export function isArmedForTrack(S, t) {
    return S.recordArmed && S.recordArmedTrack === t;
}

/**
 * @param {import('../types').State} S
 * @returns {boolean}
 */
export function isActivelyRecording(S) {
    return S.recordArmed && !S.recordCountingIn;
}

/** @returns {RecordingWorkflowState} */
export function createRecordingWorkflowState() {
    return {
        liveNoteRecordingState: createLiveNoteRecordingState(),
        drumRecNoteOns: [],
        drumRecNoteOffs: []
    };
}

/**
 * @param {import('../types').State} S
 * @param {RecordingWorkflowState} workflowState
 */
export function clearRecordingNoteBuffers(S, workflowState) {
    workflowState.liveNoteRecordingState.recordingNoteTrack.clear();
    S._recNoteOns.length = 0;
    S._recNoteOffs.length = 0;
    workflowState.drumRecNoteOns.length = 0;
    workflowState.drumRecNoteOffs.length = 0;
}

/** @param {import('../types').State} S */
export function clearPendingPrerollRecording(S) {
    S.pendingPrerollNote = null;
    S.pendingPrerollNotes = [];
    S.pendingPrerollToggleQueue = [];
    S.pendingPrerollGate = null;
}

/* Drum recording capture: enqueue a note-on/off onto the dedicated queues
 * (RecordingWorkflowState.drumRecNoteOns/Offs) the tick drain flushes into one
 * coalesced per-track set_param. The element shape is the queue contract — keep
 * it here, paired with the drain that reads `laneNote`/`vel`. Producers pass
 * just their queue (interface segregation), not the whole workflowState. */

/**
 * @param {import('../types').State} S
 * @param {any[]} drumRecNoteOns  the RecordingWorkflowState.drumRecNoteOns queue
 * @param {number} track
 * @param {number} laneNote
 * @param {number} vel
 * @param {number} lane  drum-lane index to repaint after capture, or <0 to skip
 *                       (external MIDI may receive a note mapping to no lane)
 */
export function enqueueDrumRecNoteOn(S, drumRecNoteOns, track, laneNote, vel, lane) {
    drumRecNoteOns.push({ track: track, laneNote: laneNote, vel: vel });
    if (lane >= 0) {
        S.pendingDrumLaneResync      = 3;
        S.pendingDrumLaneResyncTrack = track;
        S.pendingDrumLaneResyncLane  = lane;
    }
}

/**
 * @param {any[]} drumRecNoteOffs  the RecordingWorkflowState.drumRecNoteOffs queue
 * @param {number} track
 * @param {number} laneNote
 */
export function enqueueDrumRecNoteOff(drumRecNoteOffs, track, laneNote) {
    drumRecNoteOffs.push({ track: track, laneNote: laneNote });
}

/* Disarm real-time recording: clear DSP flag (triggers deferred save), update LED. */
/**
 * @param {import('../types').State} S
 * @param {RecordingWorkflowState} workflowState
 * @param {RecordingDeps} deps
 */
export function disarmRecordImpl(S, workflowState, deps) {
    if (!S.recordArmed) return;
    const t = S.recordArmedTrack;
    const _wasCountingIn = S.recordCountingIn;
    S.recordArmed = false;
    S.recordPendingPage = false;
    S.recordCountingIn = false;
    S.recordArmedTrack = -1;
    S.countInStartTick = -1;
    S.countInQuarterTicks = 0;
    clearRecordingNoteBuffers(S, workflowState);
    clearPendingPrerollRecording(S);
    if (t >= 0) {
        const _dat = S.trackActiveClip[t];
        S.clipAdaptiveMode[t][_dat] = false;
        if (S.trackPadMode[t] === deps.padModeDrum) {
            S.pendingDrumResync = 2;
            S.pendingDrumResyncTrack = t;
        }
    }
    S.recordScheduledStop = false;
    S.recordScheduledStopTarget = -1;
    S.pendingScheduledDisarm = false;
    if (typeof deps.setParam === 'function') {
        if (_wasCountingIn) {
            /* Count-in active: only cancel is needed; sending _recording 0 would coalesce it away */
            deps.setParam('record_count_in_cancel', '1');
        } else {
            if (t >= 0) deps.setParam('t' + t + '_recording', '0');
        }
    }
    deps.setButtonLED(deps.moveRec, deps.ledOff);
}

/* Move recording to a different track while staying armed. No-op if not actively recording. */
/**
 * @param {import('../types').State} S
 * @param {RecordingWorkflowState} workflowState
 * @param {RecordingDeps} deps
 * @param {number} newTrack
 */
export function handoffRecordingToTrackImpl(S, workflowState, deps, newTrack) {
    if (!S.recordArmed || S.recordCountingIn || newTrack === S.recordArmedTrack) return;
    const old = S.recordArmedTrack;
    workflowState.liveNoteRecordingState.recordingNoteTrack.clear();
    S.recordArmedTrack = newTrack;
    if (typeof deps.setParam === 'function') {
        if (old >= 0) deps.setParam('t' + old + '_recording', '0');
        deps.setParam('t' + newTrack + '_recording', '1');
    }
}

/**
 * Host slice the drain needs. Distinct from RecordingDeps: the drain emits
 * step/length/note set_params and reads the TARP flag, and owns the two drum
 * queues (passed in by the tick caller — they live on RecordingWorkflowState).
 *
 * @typedef {Object} RecordingDrainDeps
 * @property {(key: string, val: string) => void} host_module_set_param
 * @property {(key: string) => string} host_module_get_param
 * @property {any[]} drumRecNoteOns
 * @property {any[]} drumRecNoteOffs
 * @property {number} PAD_MODE_DRUM
 * @property {() => void} disarmRecord
 * @property {() => void} invalidateLEDCache
 * @property {() => void} forceRedraw
 */

/**
 * Flush at most one buffered-recording set_param family per tick (the coalescing
 * guarantee). Lifted verbatim from ui_tick_tasks.runRecordingEventFlush; the
 * if/else-if branch order is load-bearing — do not reorder or merge branches.
 *
 * @param {import('../types').State} S
 * @param {RecordingDrainDeps} deps
 */
export function drainRecordingQueues(S, deps) {
    /* Flush buffered recording events — one batched set_param per tick to survive coalescing.
     * Note-ons take priority; note-offs wait until the next tick if both are pending.
     * The if/else-if chain guarantees AT MOST ONE set_param family fires per tick;
     * branch order is load-bearing — do not reorder or merge branches. */
    if (!isActivelyRecording(S) || typeof deps.host_module_set_param !== 'function') return;
    const _drumRecNoteOns  = deps.drumRecNoteOns;
    const _drumRecNoteOffs = deps.drumRecNoteOffs;
    const PAD_MODE_DRUM    = deps.PAD_MODE_DRUM;
    if (S._recNoteOns.length > 0) {
        const rt   = S._recNoteOns[0].rt;
        const pairs = S._recNoteOns.map(function(n) { return n.pitch + ' ' + n.vel; }).join(' ');
        deps.host_module_set_param('t' + rt + '_record_note_on', pairs);
        S._recNoteOns.length = 0;
    } else if (_drumRecNoteOns.length > 0) {
        /* Batch all queued drum note-ons (same recordArmedTrack) into one
         * payload so a chord-press lands in DSP in a single audio buffer
         * rather than trickling out one-per-tick. */
        const rt = _drumRecNoteOns[0].track;
        const pairs = _drumRecNoteOns.map(function(n) { return n.laneNote + ' ' + n.vel; }).join(' ');
        deps.host_module_set_param('t' + rt + '_drum_record_note_on', pairs);
        _drumRecNoteOns.length = 0;
    } else if (S._recNoteOffs.length > 0) {
        const rt     = S._recNoteOffs[0].rt;
        const pitches = S._recNoteOffs.map(function(n) { return n.pitch; }).join(' ');
        deps.host_module_set_param('t' + rt + '_record_note_off', pitches);
        S._recNoteOffs.length = 0;
    } else if (_drumRecNoteOffs.length > 0) {
        const rt = _drumRecNoteOffs[0].track;
        const pitches = _drumRecNoteOffs.map(function(n) { return String(n.laneNote); }).join(' ');
        deps.host_module_set_param('t' + rt + '_drum_record_note_off', pitches);
        _drumRecNoteOffs.length = 0;
    } else if (S.pendingPrerollGate !== null) {
        const pg = S.pendingPrerollGate;
        S.pendingPrerollGate = null;
        /* Write to the first step of the loop window — playback starts at loop_start,
         * not at absolute step 0. */
        if (pg.isDrum) {
            const _ls = S.drumLaneLoopStart[pg.track] | 0;
            deps.host_module_set_param('t' + pg.track + '_l' + pg.lane + '_step_' + _ls + '_gate', String(pg.gate));
        } else {
            const _ls = S.clipLoopStart[pg.track][pg.clip] | 0;
            deps.host_module_set_param('t' + pg.track + '_c' + pg.clip + '_step_' + _ls + '_gate', String(pg.gate));
        }
    } else if (S.pendingPrerollToggleQueue.length > 0) {
        const _ptq = S.pendingPrerollToggleQueue.shift();
        const _ls = S.clipLoopStart[_ptq.track][_ptq.clip] | 0;
        deps.host_module_set_param('t' + _ptq.track + '_c' + _ptq.clip + '_step_' + _ls + '_toggle', _ptq.pitch + ' ' + _ptq.vel);
        if (_ptq.last)
            S.pendingPrerollGate = { isDrum: false, track: _ptq.track, clip: _ptq.clip, gate: _ptq.gate };
    } else if (S.pendingPrerollNote !== null && S.playing) {
        const pr = S.pendingPrerollNote;
        const _prLive = S.liveActiveNotes.has(pr.laneNote);
        if (pr.isDrum) {
            const tps = S.drumLaneTPS[pr.track] || 24;
            const elapsed = S.tickCount - S.transportStartTick;
            /* Wait for note released AND one step elapsed (skip first loop pass to avoid double-trigger) */
            if (!_prLive && elapsed >= tps) {
                S.pendingPrerollNote = null;
                const _ls = S.drumLaneLoopStart[pr.track] | 0;
                if (S.drumLaneSteps[pr.track][pr.lane][_ls] === '0') {
                    const countInDur = S.transportStartTick - pr.countInStart;
                    const dspPerJs = countInDur > 0 ? 384 / countInDur : 4;
                    const pressedDur = (pr.releasedAtTick || S.tickCount) - pr.pressedAtTick;
                    const gate = Math.max(1, Math.min(tps * 16, Math.round(pressedDur * dspPerJs)));
                    deps.host_module_set_param('t' + pr.track + '_l' + pr.lane + '_step_' + _ls + '_toggle', String(pr.vel));
                    S.pendingPrerollGate = { isDrum: true, track: pr.track, lane: pr.lane, gate };
                    S.drumLaneSteps[pr.track][pr.lane][_ls] = '1';
                    S.drumLaneHasNotes[pr.track][pr.lane] = true;
                    deps.invalidateLEDCache();
                    deps.forceRedraw();
                }
            }
        }
    } else if (S.pendingPrerollNotes.length > 0 && S.playing) {
        const pns = S.pendingPrerollNotes;
        const pr  = pns[0];
        /* TARP-on: DSP tarp_fire_step records arp output to clip directly. Skip
         * JS preroll capture so a held chord becomes an arpeggiated sequence
         * across steps instead of a chord stamped on step 0. */
        const _tarpOn = parseInt(deps.host_module_get_param('t' + pr.track + '_tarp_on'), 10) === 1;
        if (_tarpOn) {
            S.pendingPrerollNotes       = [];
            S.pendingPrerollToggleQueue = [];
            S.pendingPrerollGate        = null;
        } else {
        const _prLive = pns.some(function(n) { return S.liveActiveNotes.has(n.pitch); });
        const tps = (S.clipTPS[pr.track] && S.clipTPS[pr.track][pr.clip]) || 24;
        const elapsed = S.tickCount - S.transportStartTick;
        /* Wait for all chord notes released AND one step elapsed */
        if (!_prLive && elapsed >= tps) {
            S.pendingPrerollNotes = [];
            const _ls = S.clipLoopStart[pr.track][pr.clip] | 0;
            if (S.clipSteps[pr.track][pr.clip][_ls] === 0) {
                const countInDur = S.transportStartTick - pr.countInStart;
                const dspPerJs   = countInDur > 0 ? 384 / countInDur : 4;
                const lastRel    = pns.reduce(function(m, n) { return Math.max(m, n.releasedAtTick || S.tickCount); }, 0);
                const pressedDur = lastRel - pr.pressedAtTick;
                const gate       = Math.max(1, Math.min(tps * 16, Math.round(pressedDur * dspPerJs)));
                deps.host_module_set_param('t' + pr.track + '_c' + pr.clip + '_step_' + _ls + '_toggle', pr.pitch + ' ' + pr.vel);
                if (pns.length === 1) {
                    S.pendingPrerollGate = { isDrum: false, track: pr.track, clip: pr.clip, gate };
                } else {
                    for (let _qi = 1; _qi < pns.length; _qi++) {
                        S.pendingPrerollToggleQueue.push({
                            track: pns[_qi].track, clip: pns[_qi].clip,
                            pitch: pns[_qi].pitch,  vel: pns[_qi].vel,
                            gate, last: _qi === pns.length - 1
                        });
                    }
                }
                S.clipSteps[pr.track][pr.clip][_ls] = 1;
                S.clipNonEmpty[pr.track][pr.clip] = true;
                deps.invalidateLEDCache();
                deps.forceRedraw();
            }
        }
        }
    } else {
        /* No note event this tick — safe to send a length set_param without coalescing. */
        const _art = S.recordArmedTrack >= 0 ? S.recordArmedTrack : S.activeTrack;
        const _arac = S.trackActiveClip[_art];
        const _arDrum = S.trackPadMode[_art] === PAD_MODE_DRUM;
        if (S.pendingScheduledDisarm) {
            /* Tick 2: send tN_recording=0 alone (length was locked last tick) */
            S.pendingScheduledDisarm = false;
            deps.disarmRecord();
        } else if (S.recordScheduledStop) {
            /* Tick 1: lock clip length at page boundary; disarm deferred to next tick */
            const _sStp = _arDrum ? S.drumCurrentStep[_art] : S.trackCurrentStep[_art];
            if (_sStp >= 0 && _sStp >= S.recordScheduledStopTarget - 1) {
                const _lockLen = S.recordScheduledStopTarget;
                if (_arDrum) {
                    S.drumLaneLength[_art] = _lockLen;
                    deps.host_module_set_param('t' + _art + '_all_lanes_length', String(_lockLen));
                } else {
                    S.clipLength[_art][_arac] = _lockLen;
                    deps.host_module_set_param('t' + _art + '_c' + _arac + '_length', String(_lockLen));
                }
                S.clipAdaptiveMode[_art][_arac] = false;
                S.recordScheduledStop           = false;
                S.recordScheduledStopTarget     = -1;
                S.pendingScheduledDisarm        = true;
            }
        } else if (S.clipAdaptiveMode[_art][_arac]) {
            /* Adaptive extend: grow clip by one page when approaching boundary */
            if (_arDrum) {
                const _adCur = S.drumLaneLength[_art];
                const _adStp = S.drumCurrentStep[_art];
                if (_adStp >= 0 && _adCur > 0 && _adCur < 256 && _adStp >= _adCur - 4) {
                    const _adNew = _adCur + 16;
                    S.drumLaneLength[_art] = _adNew;
                    deps.host_module_set_param('t' + _art + '_all_lanes_length', String(_adNew));
                }
            } else {
                const _adCur = S.clipLength[_art][_arac];
                const _adStp = S.trackCurrentStep[_art];
                if (_adStp >= 0 && _adCur > 0 && _adCur < 256 && _adStp >= _adCur - 4) {
                    const _adNew = _adCur + 16;
                    S.clipLength[_art][_arac] = _adNew;
                    deps.host_module_set_param('t' + _art + '_c' + _arac + '_length', String(_adNew));
                }
            }
        }
    }
}
