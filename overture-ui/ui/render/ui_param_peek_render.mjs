import { S } from '../core/ui_state.mjs';
import { paramPeekInfo } from '../core/ui_motion.mjs';
import { renderParameterPage } from '../components/ui_parameter_page.mjs';

export function renderParamPeek(deps) {
    const p = paramPeekInfo();
    return renderParameterPage(deps, {
        title: p.header,
        context: p.detail,
        cells: [],
        pageIndex: 0,
        pageCount: 1,
        touchedParam: {
            knob: (S.knobTouched | 0) + 1,
            label: p.target,
            value: p.rawValue == null ? focusedDisplayValue(p) : p.rawValue,
            displayValue: focusedDisplayValue(p),
            type: p.type,
            min: p.min,
            max: p.max,
            status: p.status || 'peek'
        },
        status: p.route
    });
}

function focusedDisplayValue(p) {
    if (p.displayValue != null) return String(p.displayValue);
    return String(p.value || '').replace(/^Value\s+/, '').replace(/^Route:\s+/, '') || '--';
}
