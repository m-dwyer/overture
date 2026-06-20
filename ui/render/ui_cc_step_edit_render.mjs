import { S } from '../core/ui_state.mjs';
import { col4, col5 } from '../core/ui_constants.mjs';
import { effectiveClip } from './ui_leds.mjs';
import { autoLaneLabel } from '../core/ui_motion.mjs';
import {
    refreshCcGraphData,
    renderCcGraphPlot,
    renderCcPageProgress,
} from './ui_cc_lane_overlay_render.mjs';

export function renderCcStepEditView(deps) {
    const t = S.activeTrack;
    const ac = effectiveClip(t);
    const lane = S.ccActiveLane[t];
    const effectiveLength = S.ccLaneLength[t][ac][lane] || S.clipLength[t][ac];
    const laneTps = S.ccLaneTps[t][ac][lane] || (S.clipTPS[t][ac] || 24);
    const barY = 60;
    const barH = 3;
    const graphH = 12;
    const graphY = barY - graphH - 2;

    refreshCcGraphData(deps, t, ac, lane, effectiveLength,
        Math.ceil(effectiveLength / 16), 'sg_' + t + '_' + ac + '_' + lane);
    renderCcStepGraph(deps, graphY, graphH);
    renderCcStepHeader(deps, t, lane);
    renderCcStepKnobs(deps, t);
    renderCcPageProgress(deps, t, effectiveLength, laneTps, barY, barH);
}

function renderCcStepGraph(deps, graphY, graphH) {
    const dataLen = renderCcGraphPlot(deps, graphY, graphH);
    // Step-Edit marker: always shown, 1px inset, color 1.
    const stepX = Math.min(126, Math.max(1, Math.floor(S.heldStep * 126 / dataLen) + 1));
    deps.fill_rect(stepX, graphY + 1, 1, graphH - 2, 1);
}

function renderCcStepHeader(deps, t, lane) {
    deps.pixelPrint(1, 1, 'Step ' + (S.heldStep + 1), 1);
    let label = '';
    const labelLane = S.knobTouched >= 0 ? S.knobTouched : lane;
    if (S.trackCCType[t][labelLane] === 2)
        label = S.schLabel[t][labelLane] || ('Sch' + S.trackCCAssign[t][labelLane]);
    if (label) deps.pixelPrint(128 - label.length * 6 - 1, 1, label, 1);
    deps.fill_rect(0, 7, 128, 1, 1);
}

function renderCcStepKnobs(deps, t) {
    for (let k = 0; k < 8; k++) {
        const col = k % 4;
        const row = Math.floor(k / 4);
        const x = 4 + col * 31;
        const y = 11 + row * 18;
        const hi = (S.knobTouched === k) || (S.ccActiveLane[t] === k);
        if (hi) deps.fill_rect(x - 1, y - 1, 29, 18, 1);
        const label = autoLaneLabel(t, k, false);
        let value;
        if (S.ccStepEditSet[k]) {
            value = String(S.ccStepEditVal[k]);
        } else {
            const computed = S.ccStepEditComputed[k];
            value = (computed >= 0 && computed <= 127) ? '(' + computed + ')' : '--';
        }
        deps.print(x, y, col4(label), hi ? 0 : 1);
        deps.print(x, y + 9, col5(value), hi ? 0 : 1);
    }
}
