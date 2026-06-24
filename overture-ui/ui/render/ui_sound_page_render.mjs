import { S } from '../core/ui_state.mjs';
import {
    SCHWUNG_SOUND_COMPONENTS,
    clampComponentIndex,
    displayParamValue,
    visibleParamList
} from '../sound/ui_sound_page_model.mjs';
import {
    parameterPageCells,
    parameterPageCount,
    parameterPageIndex,
    renderParameterPage,
    truncText
} from '../components/ui_parameter_page.mjs';
import {
    activeStatusFlashText
} from '../components/ui_status_flash.mjs';
import {
    renderConfirmPrompt
} from '../components/ui_confirm_prompt.mjs';

function compactSlotTitle(label) {
    label = String(label || '');
    if (label === 'MIDI FX') return 'MIDI FX';
    if (label === 'Synth') return 'SYNTH';
    if (label === 'FX 1') return 'FX1';
    if (label === 'FX 2') return 'FX2';
    return label.toUpperCase();
}

function soundParameterPageModel(page, component, statusText) {
    const idx = clampComponentIndex(page.selectedIndex);
    const module = page.modules && page.modules[idx];
    const params = visibleParamList(page).map(function(p) {
        const label = p.shortName || p.short_name || p.name || p.label || p.key || '';
        return {
            label: label,
            value: displayParamValue(p),
            rawValue: p.value,
            type: p.type,
            min: p.min,
            max: p.max,
            rangeMin: p.rangeMin,
            rangeMax: p.rangeMax
        };
    });
    const pageIdx = parameterPageIndex(params, page.paramDetailIndex | 0);
    return {
        title: 'T' + (page.track + 1) + ' ' + compactSlotTitle(component.label),
        context: module && module.name ? module.name : 'Empty',
        cells: parameterPageCells(params, pageIdx),
        pageIndex: pageIdx,
        pageCount: parameterPageCount(params),
        touchedParam: page.touchedParam,
        status: statusText || '',
        emptyText: 'Params --'
    };
}

export function renderSchwungSoundPage(surface) {
    const page = S.schwungSoundPage;
    if (!page) return false;
    surface.clear_screen();
    if (page.slot < 0) {
        surface.print(0, 0, 'SOUND T' + (page.track + 1), 1);
        surface.print(0, 14, 'NO SLOT', 1);
        surface.print(0, 28, 'Ch' + (S.trackChannel[page.track] | 0), 1);
        surface.print(0, 50, 'Menu exits', 1);
        return true;
    }
    if (page.browser) {
        if (page.overwriteConfirm) return renderConfirmPrompt(surface, page.overwriteConfirm);
        const component = SCHWUNG_SOUND_COMPONENTS[clampComponentIndex(page.selectedIndex)];
        const title = page.browserKind === 'preset-save' ? 'Save ' + component.label
            : page.browserKind === 'preset' ? component.label + ' Presets'
            : component.label;
        surface.print(0, 0, truncText(title, 21), 1);
        if (page.noList) {
            surface.print(0, 18, page.browserKind === 'preset' || page.browserKind === 'preset-save' ? 'NO PRESETS' : 'NO LIST', 1);
            if (page.browserMessage && page.browserMessage !== 'NO LIST' && page.browserMessage !== 'NO PRESETS')
                surface.print(0, 32, truncText(page.browserMessage, 21), 1);
            return true;
        }
        const rowCount = 4;
        const start = Math.max(0, Math.min(page.browserIndex | 0, Math.max(0, page.browserItems.length - rowCount)));
        for (let i = 0; i < rowCount; i++) {
            const idx = start + i;
            if (idx >= page.browserItems.length) break;
            const item = page.browserItems[idx];
            const y = 14 + i * 12;
            if (item && item.divider) {
                renderSoundBrowserDivider(surface, y);
                continue;
            }
            surface.print(0, y, (idx === page.browserIndex ? '>' : ' ') + item.name, 1);
        }
        return true;
    }
    const selectedIndex = clampComponentIndex(page.selectedIndex);
    const component = SCHWUNG_SOUND_COMPONENTS[selectedIndex];
    const statusText = activeStatusFlashText(page, S.tickCount);
    return renderParameterPage(surface, soundParameterPageModel(page, component, statusText || page.browserMessage));
}

function renderSoundBrowserDivider(surface, y) {
    if (surface.fill_rect) {
        surface.fill_rect(0, y + 5, 128, 1, 1);
        return;
    }
    surface.print(0, y, '---------------------', 1);
}
