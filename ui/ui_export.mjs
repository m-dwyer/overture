/* dAVEBOx → Ableton (.ablbundle) export — orchestration (Phase 1 skeleton).
 *
 * Architecture (see notes/ableton-export-plan.md, Phase 0 RESULT):
 *  - JS builds Song.abl (text JSON — host_write_file is safe for text) + a small
 *    args manifest, then fires a one-shot on-device packager.
 *  - export/pack.py (shipped in the module dir) does the binary work: copy sample
 *    files + build the store-mode .ablbundle ZIP. Invoked via host_system_cmd
 *    (stock Schwung) running /usr/bin/python3 (stock on Move). Fully offline.
 *
 * Phase 1 scope: menu entry + transport guard + a minimal valid 8x16 bundle
 * (every track gets a Dummy Drift instrument — Live rejects a track with no
 * device; 16 empty scenes; tempo from dAVEBOx). No instrument mapping / no baked
 * MIDI / no samples yet (Phases 2-5).
 *
 * The menu action runs in MIDI-handler context where get_param returns null, so
 * exportSession() only sets a pending flag; pollPendingExport() does the work
 * from tick() (get_param-safe), matching the codebase's defer-to-tick idiom.
 */

import { S } from '/data/UserData/schwung/modules/tools/davebox/ui_state.mjs';
import { showActionPopup } from '/data/UserData/schwung/modules/tools/davebox/ui_persistence.mjs';
import { NUM_TRACKS, NUM_CLIPS, ACTION_POPUP_TICKS } from '/data/UserData/schwung/modules/tools/davebox/ui_constants.mjs';

const EXPORT_MODULE_DIR = '/data/UserData/schwung/modules/tools/davebox';
const EXPORT_OUT_DIR    = '/data/UserData/schwung/davebox-exports';
const EXPORT_STAGING    = '/data/UserData/schwung/davebox-export-staging';
const EXPORT_SCENES     = NUM_CLIPS;   /* dAVEBOx clip N -> scene N */

/* Default per-track colors (Move palette indices) for the 8 dAVEBOx tracks.
 * Cosmetic only; real per-track color mapping arrives with instruments (Phase 2). */
const DB_TRACK_COLORS = [15, 13, 11, 9, 7, 5, 3, 1];

/* ---- asset loading ------------------------------------------------------- */

function readJsonAsset(name) {
    if (typeof host_read_file !== 'function') return null;
    const raw = host_read_file(EXPORT_MODULE_DIR + '/' + name);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch (e) { return null; }
}

function deepClone(obj) { return JSON.parse(JSON.stringify(obj)); }

/* Stop-transport notice — held for 2x the normal popup duration so it's easy to
 * read (it's the one popup users hit by accident mid-jam). */
function showStopTransportNotice() {
    showActionPopup('STOP TRANSPORT', 'FOR EXPORT');
    S.actionPopupEndTick = S.tickCount + ACTION_POPUP_TICKS * 2;
}

/* ---- Song.abl authoring -------------------------------------------------- */

function buildTrack(t, driftTemplate) {
    const dev = deepClone(driftTemplate);
    const name = 'dB ' + (t + 1);
    dev.name = name;
    const clipSlots = [];
    for (let i = 0; i < EXPORT_SCENES; i++)
        clipSlots.push({ hasStop: true, clip: null });
    return {
        kind: 'midi',
        name: name,
        color: DB_TRACK_COLORS[t % DB_TRACK_COLORS.length],
        isSelected: t === 0,
        clipSlots: clipSlots,
        isNoteRepeatOn: false,
        noteRepeatRate: '1/16',
        noteRepeatArpeggio: { style: 'chordRepeat' },
        uiOctaveIndex: 4,
        midiInputMode: 'auto',
        midiOutputEndpoint: null,
        devices: [dev],
        mixer: { pan: 0.0, 'solo-cue': false, speakerOn: true, volume: 0.6137250661849976, sends: [] }
    };
}

function buildSong(bpm, driftTemplate, masterTrack) {
    const tracks = [];
    for (let t = 0; t < NUM_TRACKS; t++) tracks.push(buildTrack(t, driftTemplate));
    const scenes = [];
    for (let i = 0; i < EXPORT_SCENES; i++) scenes.push({ name: '', color: null });
    return {
        '$schema': 'http://tech.ableton.com/schema/song/1.8.2/song.json',
        stepEditorResolution: '1/16',
        tempo: bpm,
        globalGrooveAmount: 0.0,
        rootNote: (S.padKey | 0),
        scale: 'Major',           /* TODO Phase 3: map S.padScale -> Ableton scale-name vocab */
        melodicLayout: 'inKey',
        tracks: tracks,
        returnTracks: [],
        masterTrack: masterTrack,
        scenes: scenes,
        grooves: [],
        metadata: { usedFeatures: [] }
    };
}

/* ---- filename helpers ---------------------------------------------------- */

function pad2(n) { return n < 10 ? '0' + n : '' + n; }

function dateStamp() {
    const d = new Date();
    return '' + d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate());
}

/* Filesystem-safe set name; spaces collapsed, exotic chars dropped. */
function sanitizeName(name) {
    const s = (name || '').replace(/[^A-Za-z0-9 _-]/g, '').replace(/\s+/g, ' ').trim();
    return s || 'davebox';
}

/* <set>-YYYYMMDD.ablbundle, appending -2/-3/... on same-day collisions. */
function uniqueOutPath(base) {
    let p = EXPORT_OUT_DIR + '/' + base + '.ablbundle';
    if (typeof host_file_exists !== 'function' || !host_file_exists(p)) return p;
    for (let i = 2; i < 1000; i++) {
        p = EXPORT_OUT_DIR + '/' + base + '-' + i + '.ablbundle';
        if (!host_file_exists(p)) return p;
    }
    return p;
}

/* ---- public: menu action + confirm + tick drain -------------------------- */

/* Menu action (MIDI-handler context). If transport is running, show the
 * stop-transport notice and bail; otherwise open the Yes/No confirm dialog
 * (rendered inside the open global menu, like Clear Session). */
function requestExport() {
    if (S.playing) {
        S.globalMenuOpen = false;
        showStopTransportNotice();
        return;
    }
    S.confirmExport    = true;
    S.confirmExportSel = 1;     /* default No */
    S.screenDirty      = true;
}

/* Confirm-dialog "Yes" commit (MIDI-handler context). Re-checks transport in
 * case it started while the dialog was open, then arms the deferred export. */
function confirmExportStart() {
    S.confirmExport = false;
    if (S.playing) {
        S.globalMenuOpen = false;
        showStopTransportNotice();
        return;
    }
    S.pendingExport  = true;
    S.globalMenuOpen = false;
    showActionPopup('EXPORTING', '...');
}

/* tick() drain. Builds Song.abl, stages it, runs pack.py, reports via OLED. */
function pollPendingExport() {
    if (!S.pendingExport) return;
    S.pendingExport = false;

    if (typeof host_write_file !== 'function' ||
        typeof host_system_cmd !== 'function' ||
        typeof host_ensure_dir !== 'function') {
        showActionPopup('EXPORT FAIL', 'NO HOST API');
        return;
    }

    /* Tempo: get_param is valid here (tick context). */
    let bpm = 120.0;
    if (typeof host_module_get_param === 'function') {
        const v = parseFloat(host_module_get_param('bpm'));
        if (v > 0 && isFinite(v)) bpm = v;
    }

    const drift  = readJsonAsset('drift-dummy.json');
    const master = readJsonAsset('ableton-master.json');
    if (!drift || !master) {
        showActionPopup('EXPORT FAIL', 'NO TEMPLATE');
        return;
    }

    let songJson;
    try {
        songJson = JSON.stringify(buildSong(bpm, drift, master));
    } catch (e) {
        showActionPopup('EXPORT FAIL', 'BUILD');
        return;
    }

    /* Fresh staging dir. */
    if (typeof host_remove_dir === 'function') host_remove_dir(EXPORT_STAGING);
    host_ensure_dir(EXPORT_STAGING);
    host_ensure_dir(EXPORT_OUT_DIR);

    if (!host_write_file(EXPORT_STAGING + '/Song.abl', songJson)) {
        showActionPopup('EXPORT FAIL', 'WRITE SONG');
        return;
    }

    const base    = sanitizeName(S.currentSetName) + '-' + dateStamp();
    const outPath = uniqueOutPath(base);
    const statusP = EXPORT_STAGING + '/pack-status.json';

    const args = {
        staging: EXPORT_STAGING,
        out: outPath,
        samples: [],          /* Phase 5 fills this */
        status: statusP
    };
    host_write_file(EXPORT_STAGING + '/pack-args.json', JSON.stringify(args));

    /* Only fixed, space-free paths appear on the shell command line; the set
     * name (which may contain spaces) lives inside pack-args.json. */
    const cmd = "sh -c '/usr/bin/python3 " + EXPORT_MODULE_DIR +
                "/pack.py " + EXPORT_STAGING + "/pack-args.json'";
    const rc = host_system_cmd(cmd);

    let okStatus = null, errMsg = null;
    const st = host_read_file(statusP);
    if (st) {
        try {
            const s = JSON.parse(st);
            if (s && s.ok) okStatus = s;
            else errMsg = (s && s.error) ? String(s.error) : 'PACK ERR';
        } catch (e) { errMsg = 'BAD STATUS'; }
    } else {
        errMsg = 'NO STATUS rc=' + rc;
    }

    if (okStatus) {
        const bn = String(outPath).split('/').pop().replace(/\.ablbundle$/, '');
        showActionPopup('EXPORTED', bn.slice(0, 18));
    } else {
        showActionPopup('EXPORT FAIL', String(errMsg).slice(0, 18));
    }
}

export { requestExport, confirmExportStart, pollPendingExport };
