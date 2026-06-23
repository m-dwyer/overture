/* Shared CC / Motion Lane overlay renderer.
 *
 * The value-vs-step graph and page-progress bar are drawn identically by two
 * screens — the Step-Edit view (ui_cc_step_edit_render) and the Motion/Idle
 * view (ui_idle_render). These helpers hold the parts that are byte-identical
 * between them; the parts that genuinely differ (the step/playhead marker, and
 * each caller's graph cache key / laneTps source) stay at the call site, passed
 * in or drawn after the shared piece, exactly like the deliberate variant edges
 * elsewhere in the codebase.
 *
 * Presentation only: reads S + draws through deps' OLED primitives. render/ may
 * depend on core/ (S, constants) but pulls in no workflow behaviour. */

import { S } from '../core/ui_state.mjs';
import { POLL_INTERVAL } from '../core/ui_constants.mjs';

/* Refresh the cached CC-lane graph samples (S.ccGraphOvData) for the active
 * lane, throttled to the POLL_INTERVAL cadence unless the cache key changed.
 * `pages` and `key` are computed by the caller — the key PREFIX differs per
 * screen ('sg_' for Step-Edit, 'g_' for Motion idle) so switching screens
 * invalidates the shared cache. */
export function refreshCcGraphData(deps, t, ac, lane, effectiveLength, pages, key) {
    if (key === S.ccGraphOvKey && (S.tickCount % POLL_INTERVAL) !== 0) return;

    S.ccGraphOvData = [];
    for (let page = 0; page < pages; page++) {
        const raw = (typeof deps.host_module_get_param === 'function')
            ? deps.host_module_get_param('t' + t + '_c' + ac + '_ccsv_' + lane + '_' + page)
            : null;
        if (raw) {
            const parts = raw.split(' ');
            for (let step = 0; step < 16 && page * 16 + step < effectiveLength; step++)
                S.ccGraphOvData.push(step < parts.length ? parseInt(parts[step], 10) : 255);
        }
    }
    S.ccGraphOvKey = key;
}

/* Draw the graph frame (border box) and the line plot of S.ccGraphOvData within
 * it. Does NOT draw the step/playhead marker — that differs per screen and is
 * drawn by the caller AFTER this returns. Returns dataLen (the divisor both
 * callers' markers use to map heldStep -> x). */
export function renderCcGraphPlot(deps, graphY, graphH) {
    deps.fill_rect(0, graphY, 128, 1, 1);
    deps.fill_rect(0, graphY + graphH - 1, 128, 1, 1);
    deps.fill_rect(0, graphY, 1, graphH, 1);
    deps.fill_rect(127, graphY, 1, graphH, 1);
    const dataLen = S.ccGraphOvData.length || 1;
    const drawY = graphY + 2;
    const drawH = graphH - 4;
    let prevPy = -1;
    for (let x = 1; x < 127; x++) {
        const idx = Math.floor(x * dataLen / 128);
        const value = idx < S.ccGraphOvData.length ? S.ccGraphOvData[idx] : -1;
        if (value >= 0 && value <= 127) {
            const py = drawY + drawH - 1 - Math.round(value * (drawH - 1) / 127);
            if (prevPy >= 0 && prevPy !== py) {
                const yMin = Math.min(prevPy, py);
                const yMax = Math.max(prevPy, py);
                deps.fill_rect(x, yMin, 1, yMax - yMin + 1, 1);
            } else {
                deps.fill_rect(x, py, 1, 1, 1);
            }
            prevPy = py;
        } else {
            prevPy = -1;
        }
    }
    return dataLen;
}

/* Draw the per-page progress bar under the graph: a filled segment for the
 * current view page, an outlined segment for the playing page, an underline for
 * the rest, plus the moving play-dot while playing. `laneTps` is supplied by the
 * caller (Step-Edit precomputes it in its view fn; Motion idle computes the same
 * expression inline). */
export function renderCcPageProgress(deps, t, effectiveLength, laneTps, barY, barH) {
    const pageCount = Math.max(1, Math.ceil(effectiveLength / 16));
    const viewPage = Math.max(0, Math.min(S.trackCurrentPage[t], pageCount - 1));
    const pageGap = 1;
    const pageW = Math.max(2, Math.floor((120 - (pageCount - 1) * pageGap) / pageCount));
    let playPage = -1;
    let progress = 0;
    if (S.playing) {
        progress = (S.masterPos % (effectiveLength * laneTps)) / (effectiveLength * laneTps);
        playPage = Math.floor(progress * pageCount);
    }
    for (let page = 0; page < pageCount; page++) {
        const x = 4 + page * (pageW + pageGap);
        if (page === viewPage) {
            deps.fill_rect(x, barY, pageW, barH, 1);
        } else if (page === playPage) {
            deps.fill_rect(x, barY, pageW, 1, 1);
            deps.fill_rect(x, barY + barH - 1, pageW, 1, 1);
            deps.fill_rect(x, barY, 1, barH, 1);
            deps.fill_rect(x + pageW - 1, barY, 1, barH, 1);
        } else {
            deps.fill_rect(x, barY + barH - 1, pageW, 1, 1);
        }
    }
    if (S.playing) {
        const barW = pageCount * (pageW + pageGap) - pageGap;
        const dotX = 4 + Math.floor(progress * barW);
        const viewStart = 4 + viewPage * (pageW + pageGap);
        deps.fill_rect(dotX, barY, 1, barH, (dotX >= viewStart && dotX < viewStart + pageW) ? 0 : 1);
    }
}
