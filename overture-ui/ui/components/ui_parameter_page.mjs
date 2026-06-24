import {
    compactLayoutLabel,
    compactLayoutValue,
    renderEncoderValueGrid,
    renderHeaderPill,
    splitLayoutWords
} from '../render/ui_oled_layout.mjs';

/**
 * @typedef {Object} ParameterPageSurface
 * @property {(x: number, y: number, text: string, color: number) => void} print
 * @property {(x: number, y: number, w: number, h: number, color: number) => void=} fill_rect
 */

/**
 * @param {import('../types').ParameterPageParam[]} params
 * @param {number} pageIndex
 * @returns {import('../types').ParameterPageCellSlot[]}
 */
export function parameterPageCells(params, pageIndex) {
    const start = Math.max(0, pageIndex | 0) * 8;
    /** @type {import('../types').ParameterPageCellSlot[]} */
    const cells = [];
    for (let i = 0; i < 8; i++) {
        const p = params[start + i];
        if (!p) continue;
        cells.push({
            label: p.label || '',
            value: p.value,
            highlighted: false
        });
    }
    return cells;
}

/**
 * @param {import('../types').ParameterPageParam[]} params
 * @param {number} paramIndex
 * @returns {number}
 */
export function parameterPageIndex(params, paramIndex) {
    const count = parameterPageCount(params);
    return Math.max(0, Math.min(count - 1, Math.floor(Math.max(0, paramIndex | 0) / 8)));
}

/**
 * @param {import('../types').ParameterPageParam[]} params
 * @returns {number}
 */
export function parameterPageCount(params) {
    return Math.max(1, Math.ceil((params || []).length / 8));
}

/**
 * @param {import('../types').ParameterPageParam[]} params
 * @param {number} pageIndex
 * @param {number} knobIdx
 * @param {import('../types').FocusedParameter['status']=} status
 * @returns {import('../types').FocusedParameter}
 */
export function parameterPageFocusedParam(params, pageIndex, knobIdx, status) {
    knobIdx = knobIdx | 0;
    const p = params[Math.max(0, pageIndex | 0) * 8 + knobIdx];
    if (!p) {
        return { knob: knobIdx + 1, label: '--', displayValue: '--', status: 'empty' };
    }
    return {
        knob: knobIdx + 1,
        label: p.label || '--',
        value: p.rawValue == null ? p.value : p.rawValue,
        displayValue: p.value,
        type: p.type,
        min: p.min,
        max: p.max,
        rangeMin: p.rangeMin,
        rangeMax: p.rangeMax,
        status: status || 'peek'
    };
}

/**
 * @param {ParameterPageSurface} surface
 * @param {import('../types').ParameterPageModel} model
 * @returns {boolean}
 */
export function renderParameterPage(surface, model) {
    if (model.touchedParam) {
        return renderFocusedParameter(surface, model);
    }

    renderHeaderPill(surface, model.title, model.context || '', { titleMax: 8, pillMax: 10 });
    renderEncoderValueGrid(surface, model.cells, Object.assign({
        mode: 'encoder-grid',
        startY: 14,
        pageIdx: model.pageIndex,
        pageCount: model.pageCount,
        emptyText: model.emptyText || 'No mapped params'
    }, model.grid || {}));

    if (model.status) {
        surface.print(0, 54, truncText(model.status, 21), 1);
    }
    return true;
}

/**
 * @param {ParameterPageSurface} surface
 * @param {import('../types').ParameterPageModel} model
 * @returns {boolean}
 */
function renderFocusedParameter(surface, model) {
    const touched = model.touchedParam;
    if (!touched) return false;
    const title = truncText([model.title, model.context].filter(Boolean).join(' '), 17);
    if (surface.fill_rect) surface.fill_rect(0, 0, 128, 9, 1);
    surface.print(2, 1, title, surface.fill_rect ? 0 : 1);
    surface.print(110, 1, 'K' + (touched.knob | 0), surface.fill_rect ? 0 : 1);

    const lines = wrapParamLabel(readableParamName(touched.label || '--'), 21);
    surface.print(0, 14, lines[0], 1);
    if (lines[1]) surface.print(0, 24, lines[1], 1);

    const value = focusedParamValue(touched);
    const valueText = truncText(value, 21);
    if (surface.fill_rect) {
        surface.fill_rect(0, 36, 128, 12, 1);
        surface.print(centerX(valueText), 38, valueText, 0);
    } else {
        surface.print(0, 38, valueText, 1);
    }

    const status = focusedParamStatus(touched);
    if (status) {
        surface.print(0, 54, status, 1);
    } else if (!renderFocusedRangeBar(surface, touched)) {
        surface.print(0, 54, 'Page ' + (model.pageIndex + 1) + '/' + model.pageCount, 1);
    }
    return true;
}

/**
 * @param {import('../types').FocusedParameter} touched
 * @returns {string}
 */
function focusedParamValue(touched) {
    if (!touched) return '--';
    if (touched.status === 'empty') return 'No param';
    if (touched.status === 'unmapped') return 'Unmapped';
    if (touched.status === 'unavailable') return 'No write';
    return touched.displayValue || compactLayoutValue(touched.value, 21);
}

/**
 * @param {import('../types').FocusedParameter} touched
 * @returns {string}
 */
function focusedParamStatus(touched) {
    if (!touched) return '';
    if (touched.status === 'readOnly') return 'Read only';
    if (touched.status === 'empty' || touched.status === 'unmapped' || touched.status === 'unavailable') return '';
    return '';
}

/**
 * @param {ParameterPageSurface} surface
 * @param {import('../types').FocusedParameter} touched
 * @returns {boolean}
 */
function renderFocusedRangeBar(surface, touched) {
    if (!surface.fill_rect) return false;
    const type = String(touched.type || '').toLowerCase();
    if (type === 'enum' || type === 'bool' || type === 'boolean' || type === 'string' || type === 'filepath' || type === 'file' || type === 'canvas') return false;
    const min = firstFiniteNumber(touched.min, touched.rangeMin);
    const max = firstFiniteNumber(touched.max, touched.rangeMax);
    const value = parseFloat(String(touched.value));
    if (!Number.isFinite(min) || !Number.isFinite(max) || max <= min || !Number.isFinite(value)) return false;
    const frac = Math.max(0, Math.min(1, (value - min) / (max - min)));
    surface.fill_rect(0, 55, 128, 1, 1);
    surface.fill_rect(0, 61, 128, 1, 1);
    surface.fill_rect(0, 55, 1, 7, 1);
    surface.fill_rect(127, 55, 1, 7, 1);
    surface.fill_rect(1, 56, Math.max(1, Math.min(126, Math.round(frac * 126))), 5, 1);
    return true;
}

/**
 * @param {string} text
 * @returns {number}
 */
function centerX(text) {
    return Math.max(0, Math.floor((128 - String(text || '').length * 6) / 2));
}

/**
 * @param {string} label
 * @param {number} maxLen
 * @returns {string[]}
 */
function wrapParamLabel(label, maxLen) {
    label = String(label || '--');
    maxLen = maxLen | 0;
    if (label.length <= maxLen) return [label, ''];
    const words = label.split(/\s+/).filter(Boolean);
    let line = '';
    const lines = [];
    for (let i = 0; i < words.length; i++) {
        const next = line ? line + ' ' + words[i] : words[i];
        if (next.length <= maxLen) {
            line = next;
        } else {
            if (line) lines.push(line);
            line = words[i];
        }
        if (lines.length === 1) break;
    }
    if (line) lines.push(line);
    return [truncText(lines[0] || label, maxLen), truncText(lines[1] || '', maxLen)];
}

/**
 * @returns {number}
 */
function firstFiniteNumber() {
    for (let i = 0; i < arguments.length; i++) {
        const n = parseFloat(arguments[i]);
        if (Number.isFinite(n)) return n;
    }
    return NaN;
}

/**
 * @param {string} name
 * @returns {string}
 */
function readableParamName(name) {
    return splitLayoutWords(name).join(' ');
}

/**
 * @param {string} v
 * @param {number} maxLen
 * @returns {string}
 */
export function truncText(v, maxLen) {
    v = String(v || '');
    maxLen = maxLen | 0;
    return v.length > maxLen ? v.slice(0, maxLen) : v;
}

/**
 * @param {{ shortName?: string, short_name?: string, name?: string, label?: string, key?: string }} p
 * @param {number} maxLen
 * @returns {string}
 */
export function compactParameterLabel(p, maxLen) {
    return compactLayoutLabel(p.shortName || p.short_name || p.name || p.label || p.key || '', maxLen);
}
