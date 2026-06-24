import { S } from '../core/ui_state.mjs';
import { dlog } from '../core/ui_debug_log.mjs';
import {
    EDIT_SOUND_PREFLIGHT_TICKS,
    describeEditSoundForTrack,
    schSlotsForTrack
} from '../core/ui_routes.mjs';
import {
    SCHWUNG_SOUND_COMPONENTS,
    clampComponentIndex,
    displayParamValue,
    nextEditableParamValue,
    normalizeSchwungModuleIdentity,
    normalizeSchwungModuleList,
    readSchwungChainKnobSummary,
    readSchwungComponentParams,
    readSchwungModuleIdentity,
    readSchwungModuleName,
    visibleParamList
} from './ui_sound_page_model.mjs';
import {
    expireStatusFlash,
    showStatusFlash
} from '../components/ui_status_flash.mjs';
import {
    confirmPromptAction,
    createConfirmPrompt,
    rotateConfirmPrompt
} from '../components/ui_confirm_prompt.mjs';
import {
    createBrowserDivider,
    createBrowserItem,
    firstSelectableBrowserIndex,
    isSelectableBrowserItem,
    nextSelectableBrowserIndex
} from '../components/ui_browser_model.mjs';
import {
    listSchwungSoundPresets,
    loadSchwungSoundPreset,
    saveSchwungSoundPreset,
    suggestedSchwungSoundPresetName
} from './ui_sound_preset_repository.mjs';
import {
    listSchwungModuleFactoryPresets,
    loadSchwungModuleFactoryPreset
} from './ui_schwung_factory_preset_adapter.mjs';

const SOUND_PARAM_PEEK_MS = 1000;
const SOUND_STATUS_FLASH_TICKS = 90;
const CREATE_PRESET_ENTRY = createBrowserItem('Create new', { createNew: true });
const MODULE_PRESET_DIVIDER = createBrowserDivider('');

export {
    SCHWUNG_SOUND_COMPONENTS,
    normalizeSchwungModuleIdentity,
    normalizeSchwungModuleList
};

function queueEditSoundEntry(t, route, slot) {
    S.pendingEditSoundEntry = {
        track: t | 0,
        route: route | 0,
        slot: slot | 0,
        delay: EDIT_SOUND_PREFLIGHT_TICKS
    };
    S.screenDirty = true;
}

export function clearPendingEditSoundEntry() {
    S.pendingEditSoundEntry = null;
}

function currentModuleIdForComponent(page, component) {
    if (!page || !component || !component.read) return '';
    const v = readSchwungModuleName(page.slot, component);
    return v === '--' ? '' : v;
}

function soundParamFeedbackForKnob(page, knobIdx, status) {
    const params = visibleParamList(page);
    const pageCount = Math.max(1, Math.ceil(params.length / 8));
    const pageIdx = Math.max(0, Math.min(pageCount - 1, Math.floor((page.paramDetailIndex | 0) / 8)));
    const p = params[pageIdx * 8 + knobIdx];
    if (!p) return { knob: knobIdx + 1, label: '--', value: '--', displayValue: '--', status: 'empty' };
    return {
        knob: knobIdx + 1,
        label: p.name || p.key || '--',
        value: p.value,
        displayValue: displayParamValue(p),
        type: p.type,
        min: p.min,
        max: p.max,
        rangeMin: p.rangeMin,
        rangeMax: p.rangeMax,
        status
    };
}

function setTouchedParamFeedback(page, feedback) {
    const nowMs = (typeof Date !== 'undefined' && Date.now) ? Date.now() : NaN;
    page.touchedParam = Object.assign({}, feedback, {
        expireAtMs: Number.isFinite(nowMs) ? nowMs + SOUND_PARAM_PEEK_MS : NaN,
        expireTick: (S.tickCount | 0) + 50
    });
}

function soundEditTraceState(label, page) {
    OVERTURE_DEBUG_LOG && dlog('DEBUG', 'sound-edit ' + label
        + ' page=' + (page ? 1 : 0)
        + ' slot=' + (page ? (page.slot | 0) : -1)
        + ' browser=' + (page && page.browser ? 1 : 0)
        + ' kind=' + (page ? (page.browserKind || '') : '')
        + ' selected=' + (page ? (page.selectedIndex | 0) : -1)
        + ' copy=' + (S.copyHeld ? 1 : 0)
        + ' cap=' + (S.captureHeld ? 1 : 0)
        + ' shift=' + (S.shiftHeld ? 1 : 0)
        + ' mute=' + (S.muteHeld ? 1 : 0)
        + ' del=' + (S.deleteHeld ? 1 : 0)
        + ' loop=' + (S.loopHeld ? 1 : 0)
        + ' sv=' + (S.sessionView ? 1 : 0)
        + ' pendingPadMap=' + (S.pendingPadNoteMapRecompute ? 1 : 0)
        + ' lastMuted=' + (S.lastPushedMuted ? 1 : 0));
}

function releaseSoundBrowserPadModalState() {
    soundEditTraceState('release-pad-modal-before', S.schwungSoundPage);
    if (typeof globalThis.host_pad_block === 'function') globalThis.host_pad_block(0);
    S.shiftHeld = false;
    S.deleteHeld = false;
    S.muteHeld = false;
    S.copyHeld = false;
    S.copySrc = null;
    S.captureHeld = false;
    S.loopHeld = false;
    S.loopJogActive = false;
    S.shiftTrackLEDActive = false;
    S.pendingPadNoteMapRecompute = true;
    soundEditTraceState('release-pad-modal-after', S.schwungSoundPage);
}

function rememberSchwungSoundPosition(page) {
    if (!page || page.track == null || !S.schwungSoundMemory) return;
    const track = page.track | 0;
    if (track < 0 || track >= S.schwungSoundMemory.length) return;
    S.schwungSoundMemory[track] = {
        selectedIndex: clampComponentIndex(page.selectedIndex | 0),
        paramDetailIndex: Math.max(0, page.paramDetailIndex | 0),
        paramDetail: !!page.paramDetail
    };
}

function componentHasParams(page, idx) {
    idx = clampComponentIndex(idx);
    if (idx >= 0 && idx < 4 && page.componentParams && page.componentParams[idx] && page.componentParams[idx].length) return true;
    return !!(page.chainParams && page.chainParams.length && idx === 1);
}

function firstPlayableComponentIndex(page) {
    const memory = S.schwungSoundMemory && S.schwungSoundMemory[page.track | 0];
    if (memory && componentHasParams(page, memory.selectedIndex)) return clampComponentIndex(memory.selectedIndex);
    if (componentHasParams(page, 1)) return 1;
    for (let i = 0; i < 4; i++) {
        if (componentHasParams(page, i)) return i;
    }
    return memory ? clampComponentIndex(memory.selectedIndex) : 1;
}

function restoreSchwungSoundPosition(page) {
    const memory = S.schwungSoundMemory && S.schwungSoundMemory[page.track | 0];
    const selectedIndex = firstPlayableComponentIndex(page);
    page.selectedIndex = selectedIndex;
    page.paramDetailIndex = memory && memory.selectedIndex === selectedIndex ? Math.max(0, memory.paramDetailIndex | 0) : 0;
    page.paramDetail = componentHasParams(page, selectedIndex) && (!memory || memory.paramDetail !== false || memory.selectedIndex !== selectedIndex);
    page.touchedParam = null;
}

export function refreshSchwungSoundPageModules() {
    const page = S.schwungSoundPage;
    if (!page) return;
    page.modules = SCHWUNG_SOUND_COMPONENTS.map(function(c) {
        return c.read ? readSchwungModuleIdentity(page.slot, c) : null;
    });
    page.names = page.modules.map(function(module) {
        return module ? module.name : '';
    });
    page.componentParams = SCHWUNG_SOUND_COMPONENTS.map(function(c) {
        return readSchwungComponentParams(page.slot, c);
    });
    page.chainParams = readSchwungChainKnobSummary(page.slot);
    S.screenDirty = true;
}

export function openSchwungSoundPage(t, slot) {
    S.pendingEditSoundEntry = null;
    S.globalMenuOpen = false;
    S.lastSentMenuEditValue = null;
    S.schwungSoundPage = {
        track: t | 0,
        slot: slot | 0,
        selectedIndex: 1,
        browser: false,
        browserKind: '',
        browserItems: [],
        browserIndex: 0,
        noList: false,
        browserMessage: '',
        overwriteConfirm: null,
        statusFlash: null,
        paramDetail: false,
        paramDetailIndex: 0,
        touchedParam: null,
        paramValueOverrides: {},
        modules: [],
        componentParams: [],
        chainParams: [],
        names: []
    };
    refreshSchwungSoundPageModules();
    restoreSchwungSoundPosition(S.schwungSoundPage);
    soundEditTraceState('open-page', S.schwungSoundPage);
}

export function closeSchwungSoundPage() {
    if (!S.schwungSoundPage) return false;
    S.schwungSoundPage = null;
    S.screenDirty = true;
    return true;
}

export function closeSchwungSoundBrowser() {
    const page = S.schwungSoundPage;
    if (!page || !page.browser) return false;
    page.browser = false;
    page.browserKind = '';
    page.browserItems = [];
    page.browserIndex = 0;
    page.noList = false;
    page.browserMessage = '';
    page.overwriteConfirm = null;
    S.screenDirty = true;
    return true;
}

function filterHostModulesForComponent(componentType) {
    if (typeof globalThis.host_list_modules !== 'function') return null;
    return normalizeSchwungModuleList(globalThis.host_list_modules()).filter(function(item) {
        return item.componentType === componentType;
    });
}

export function openSchwungSoundBrowser() {
    const page = S.schwungSoundPage;
    if (!page) return false;
    if (page.slot < 0) {
        S.screenDirty = true;
        return true;
    }
    const component = SCHWUNG_SOUND_COMPONENTS[clampComponentIndex(page.selectedIndex)];
    if (!component.param) return { deepEdit: true, track: page.track, slot: page.slot };
    if (typeof globalThis.shadow_list_modules_for_component === 'function') {
        page.browserItems = normalizeSchwungModuleList(
            globalThis.shadow_list_modules_for_component(component.list),
            component.list
        );
    } else {
        const hostItems = filterHostModulesForComponent(component.list);
        if (hostItems === null) {
            page.browser = true;
            page.browserKind = 'module';
            page.browserItems = [];
            page.browserIndex = 0;
            page.noList = true;
            page.browserMessage = 'Needs hook';
            S.screenDirty = true;
            return true;
        }
        page.browserItems = hostItems;
    }
    if (!page.browserItems.length && component.list === 'sound_generator') {
        const synthItems = filterHostModulesForComponent('synth');
        if (synthItems && synthItems.length) page.browserItems = synthItems;
    }
    if (!page.browserItems.length) {
        page.browser = true;
        page.browserKind = 'module';
        page.browserIndex = 0;
        page.noList = true;
        page.browserMessage = 'NO LIST';
        S.screenDirty = true;
        return true;
    }
    page.browser = true;
    page.browserKind = 'module';
    const currentId = currentModuleIdForComponent(page, component);
    const currentIndex = currentId
        ? page.browserItems.findIndex(function(item) { return item.id === currentId; })
        : -1;
    page.browserIndex = currentIndex >= 0 ? currentIndex : 0;
    page.noList = page.browserItems.length === 0;
    page.browserMessage = '';
    S.screenDirty = true;
    return true;
}

export function openSchwungSoundPresetBrowser() {
    const page = S.schwungSoundPage;
    if (!page) return false;
    soundEditTraceState('preset-browser-open-before', page);
    if (page.slot < 0) {
        S.screenDirty = true;
        return true;
    }
    const userPresets = listSchwungSoundPresets(SCHWUNG_SOUND_COMPONENTS, page);
    const factoryPresets = listSchwungModuleFactoryPresets(SCHWUNG_SOUND_COMPONENTS, page);
    const items = factoryPresets.length
        ? userPresets.concat([MODULE_PRESET_DIVIDER], factoryPresets)
        : userPresets;
    page.browser = true;
    page.browserKind = 'preset';
    page.browserItems = items;
    page.browserIndex = firstSelectableBrowserIndex(items);
    page.noList = items.length === 0;
    page.browserMessage = items.length ? '' : 'NO PRESETS';
    page.overwriteConfirm = null;
    S.screenDirty = true;
    OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-edit preset-browser-open items=' + items.length);
    soundEditTraceState('preset-browser-open-after', page);
    return true;
}

function openTextKeyboard(textKeyboard, opts) {
    if (textKeyboard && typeof textKeyboard.open === 'function') return textKeyboard.open(opts);
    if (typeof textKeyboard === 'function') {
        textKeyboard(opts);
        return true;
    }
    return false;
}

function resetSoundBrowser(page) {
    page.browser = false;
    page.browserKind = '';
    page.browserItems = [];
    page.browserIndex = 0;
    page.noList = false;
    page.overwriteConfirm = null;
}

function saveSchwungSoundPresetWithFeedback(page, name) {
    const result = saveSchwungSoundPreset(SCHWUNG_SOUND_COMPONENTS, page, name);
    showStatusFlash(page, result && result.ok ? 'SAVED' : ((result && result.reason) || 'SAVE FAILED'), S.tickCount, SOUND_STATUS_FLASH_TICKS);
    resetSoundBrowser(page);
    releaseSoundBrowserPadModalState();
    S.screenDirty = true;
    OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-edit save-confirm result=' + (result && result.ok ? 'ok' : ((result && result.reason) || 'fail')));
    soundEditTraceState('save-confirm-after', page);
    return result;
}

function openSchwungSoundPresetNameEntry(textKeyboard, page, initialText) {
    return openTextKeyboard(textKeyboard, {
        title: 'Name',
        defaultText: initialText,
        onConfirm: function(name) {
            OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-edit save-confirm name=' + String(name || ''));
            saveSchwungSoundPresetWithFeedback(page, name);
        },
        onCancel: function() {
            releaseSoundBrowserPadModalState();
            S.screenDirty = true;
        }
    });
}

export function beginSaveSchwungSoundPreset(textKeyboard) {
    const page = S.schwungSoundPage;
    if (!page || page.slot < 0) return false;
    const items = listSchwungSoundPresets(SCHWUNG_SOUND_COMPONENTS, page).concat([CREATE_PRESET_ENTRY]);
    page.browser = true;
    page.browserKind = 'preset-save';
    page.browserItems = items;
    page.browserIndex = 0;
    page.noList = false;
    page.browserMessage = '';
    page.overwriteConfirm = null;
    S.screenDirty = true;
    OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-edit preset-save-browser-open items=' + items.length);
    return true;
}

export function applySchwungSoundBrowserSelection(textKeyboard) {
    const page = S.schwungSoundPage;
    if (!page || !page.browser || page.slot < 0 || page.noList) return false;
    soundEditTraceState('browser-apply-before', page);
    if (page.overwriteConfirm) {
        const prompt = page.overwriteConfirm;
        page.overwriteConfirm = null;
        if (confirmPromptAction(prompt) === 'confirm') {
            saveSchwungSoundPresetWithFeedback(page, prompt.payload && prompt.payload.name ? prompt.payload.name : '');
        } else {
            S.screenDirty = true;
        }
        return true;
    }
    if (page.browserKind === 'preset') {
        const entry = page.browserItems[page.browserIndex | 0];
        if (!isSelectableBrowserItem(entry)) return true;
        OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-edit preset-apply index=' + (page.browserIndex | 0)
            + ' name=' + (entry && entry.name ? entry.name : '')
            + ' module=' + (entry && entry.moduleId ? entry.moduleId : ''));
        const result = entry && entry.factoryPreset
            ? loadSchwungModuleFactoryPreset(SCHWUNG_SOUND_COMPONENTS, page, entry)
            : loadSchwungSoundPreset(SCHWUNG_SOUND_COMPONENTS, page, entry);
        page.browser = false;
        page.browserKind = '';
        page.browserItems = [];
        page.browserIndex = 0;
        page.noList = false;
        showStatusFlash(page, result && result.ok
            ? (entry && entry.factoryPreset ? 'FACTORY' : 'LOADED')
            : ((result && result.reason) || 'LOAD FAILED'), S.tickCount, SOUND_STATUS_FLASH_TICKS);
        page.paramValueOverrides = {};
        releaseSoundBrowserPadModalState();
        refreshSchwungSoundPageModules();
        OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-edit preset-apply result=' + (result && result.ok ? 'ok' : ((result && result.reason) || 'fail')));
        soundEditTraceState('browser-apply-after', page);
        return true;
    }
    if (page.browserKind === 'preset-save') {
        const entry = page.browserItems[page.browserIndex | 0];
        if (!isSelectableBrowserItem(entry)) return true;
        if (!entry) return false;
        if (entry.createNew) {
            const initialText = suggestedSchwungSoundPresetName(SCHWUNG_SOUND_COMPONENTS, page);
            if (!openSchwungSoundPresetNameEntry(textKeyboard, page, initialText)) return false;
            resetSoundBrowser(page);
            S.screenDirty = true;
            return true;
        }
        page.overwriteConfirm = createConfirmPrompt({
            title: 'Overwrite?',
            message: entry.name || '',
            cancelLabel: 'No',
            confirmLabel: 'Yes',
            defaultConfirm: false,
            payload: entry
        });
        S.screenDirty = true;
        return true;
    }
    const component = SCHWUNG_SOUND_COMPONENTS[clampComponentIndex(page.selectedIndex)];
    const item = page.browserItems[page.browserIndex | 0];
    if (!component || !component.param || !item) return false;
    if (typeof globalThis.shadow_set_param !== 'function') {
        page.noList = true;
        S.screenDirty = true;
        return true;
    }
    globalThis.shadow_set_param(page.slot | 0, component.param, item.id);
    page.browser = false;
    page.browserKind = '';
    page.browserItems = [];
    page.browserIndex = 0;
    page.noList = false;
    page.browserMessage = '';
    page.paramValueOverrides = {};
    refreshSchwungSoundPageModules();
    page.paramDetail = componentHasParams(page, page.selectedIndex);
    page.paramDetailIndex = 0;
    page.touchedParam = null;
    rememberSchwungSoundPosition(page);
    return true;
}

export function rotateSchwungSoundPage(delta) {
    const page = S.schwungSoundPage;
    if (!page || delta === 0) return false;
    if (page.browser) {
        if (page.overwriteConfirm) {
            if (!rotateConfirmPrompt(page.overwriteConfirm, delta)) return false;
            S.screenDirty = true;
            return true;
        }
        page.browserIndex = nextSelectableBrowserIndex(page.browserItems, page.browserIndex, delta);
    } else if (page.paramDetail) {
        const params = visibleParamList(page);
        const pageCount = Math.max(1, Math.ceil(params.length / 8));
        const currentPage = Math.max(0, Math.min(pageCount - 1, Math.floor((page.paramDetailIndex | 0) / 8)));
        const nextPage = Math.max(0, Math.min(pageCount - 1, currentPage + delta));
        page.paramDetailIndex = nextPage * 8;
        if (nextPage !== currentPage) page.touchedParam = null;
    } else {
        page.selectedIndex = clampComponentIndex((page.selectedIndex | 0) + delta);
        page.paramDetailIndex = 0;
        page.touchedParam = null;
    }
    rememberSchwungSoundPosition(page);
    S.screenDirty = true;
    return true;
}

export function toggleSchwungSoundParamDetail() {
    const page = S.schwungSoundPage;
    if (!page || page.browser) return false;
    const component = SCHWUNG_SOUND_COMPONENTS[clampComponentIndex(page.selectedIndex)];
    if (!component || !component.read) return false;
    page.paramDetail = !page.paramDetail;
    page.paramDetailIndex = 0;
    page.touchedParam = null;
    rememberSchwungSoundPosition(page);
    S.screenDirty = true;
    return true;
}

export function selectSchwungSoundComponent(idx) {
    const page = S.schwungSoundPage;
    if (!page || page.browser) return false;
    idx = idx | 0;
    if (idx < 0 || idx > 3) return false;
    page.selectedIndex = idx;
    page.paramDetailIndex = 0;
    page.touchedParam = null;
    page.paramDetail = componentHasParams(page, idx);
    rememberSchwungSoundPosition(page);
    S.screenDirty = true;
    return true;
}

export function adjustSchwungSoundVisibleParam(knobIdx, delta) {
    const page = S.schwungSoundPage;
    if (!page || !page.paramDetail || page.browser || delta === 0) return false;
    knobIdx = knobIdx | 0;
    if (knobIdx < 0 || knobIdx > 7) return false;
    const params = visibleParamList(page);
    const pageCount = Math.max(1, Math.ceil(params.length / 8));
    const pageIdx = Math.max(0, Math.min(pageCount - 1, Math.floor((page.paramDetailIndex | 0) / 8)));
    const p = params[pageIdx * 8 + knobIdx];
    if (!p) {
        setTouchedParamFeedback(page, { knob: knobIdx + 1, label: '--', value: '--', displayValue: '--', status: 'empty' });
        S.screenDirty = true;
        return true;
    }
    if (!p.prefix || !p.key) {
        setTouchedParamFeedback(page, { knob: knobIdx + 1, label: p.name || p.key || '--', value: '--', displayValue: '--', status: 'unmapped' });
        S.screenDirty = true;
        return true;
    }
    if (typeof globalThis.shadow_set_param !== 'function') {
        setTouchedParamFeedback(page, { knob: knobIdx + 1, label: p.name || p.key, value: '--', displayValue: '--', status: 'unavailable' });
        S.screenDirty = true;
        return true;
    }
    const next = nextEditableParamValue(p, delta);
    if (next == null) {
        setTouchedParamFeedback(page, {
            knob: knobIdx + 1,
            label: p.name || p.key,
            value: p.value,
            displayValue: displayParamValue(p),
            type: p.type,
            min: p.min,
            max: p.max,
            rangeMin: p.rangeMin,
            rangeMax: p.rangeMax,
            status: 'readOnly'
        });
        S.screenDirty = true;
        return true;
    }
    globalThis.shadow_set_param(page.slot | 0, p.prefix + ':' + p.key, next);
    if (!page.paramValueOverrides) page.paramValueOverrides = {};
    page.paramValueOverrides[p.prefix + ':' + p.key] = String(next);
    p.value = next;
    setTouchedParamFeedback(page, {
        knob: knobIdx + 1,
        label: p.name || p.key,
        value: next,
        displayValue: displayParamValue(p),
        type: p.type,
        min: p.min,
        max: p.max,
        rangeMin: p.rangeMin,
        rangeMax: p.rangeMax,
        status: 'edited'
    });
    const selectedIdx = clampComponentIndex(page.selectedIndex);
    if (page.componentParams && page.componentParams[selectedIdx]) {
        const real = page.componentParams[selectedIdx].find(function(cp) { return cp.key === p.key; });
        if (real) real.value = next;
    }
    S.screenDirty = true;
    return true;
}

export function touchSchwungSoundVisibleParam(knobIdx) {
    const page = S.schwungSoundPage;
    if (!page || !page.paramDetail || page.browser) return false;
    knobIdx = knobIdx | 0;
    if (knobIdx < 0 || knobIdx > 7) return false;
    setTouchedParamFeedback(page, soundParamFeedbackForKnob(page, knobIdx, 'peek'));
    S.screenDirty = true;
    return true;
}

export function expireSchwungSoundParamPeek() {
    const page = S.schwungSoundPage;
    if (!page || !page.touchedParam) return false;
    const nowMs = (typeof Date !== 'undefined' && Date.now) ? Date.now() : NaN;
    if (Number.isFinite(nowMs) && Number.isFinite(page.touchedParam.expireAtMs)) {
        if (nowMs < page.touchedParam.expireAtMs) return false;
    } else if ((S.tickCount | 0) < (page.touchedParam.expireTick | 0)) {
        return false;
    }
    page.touchedParam = null;
    S.screenDirty = true;
    return true;
}

export function expireSchwungSoundStatusFlash() {
    const page = S.schwungSoundPage;
    if (!expireStatusFlash(page, S.tickCount)) return false;
    S.screenDirty = true;
    return true;
}

export function requestEditSoundForTrack(t, caps) {
    clearPendingEditSoundEntry();
    S.globalMenuOpen = false;
    S.lastSentMenuEditValue = null;

    const desc = describeEditSoundForTrack(t, caps);
    if (desc.slotMask) S._coRunChanSlots = desc.slotMask;
    if (desc.queue && desc.queue.route === 0)
        openSchwungSoundPage(desc.queue.track, desc.queue.slot);
    else if (desc.queue)
        queueEditSoundEntry(desc.queue.track, desc.queue.route, desc.queue.slot);
    return { title: desc.title, body: desc.body };
}

export function refreshSchwungCoRunSlotMask(t) {
    const mask = schSlotsForTrack(t);
    S._coRunChanSlots = mask;
    return mask;
}

export function advancePendingEditSoundEntry(activeTrack) {
    const e = S.pendingEditSoundEntry;
    if (!e) return null;

    if (e.track !== activeTrack || e.route !== (S.trackRoute[e.track] | 0)) {
        clearPendingEditSoundEntry();
        return null;
    }

    if (--e.delay > 0) return null;

    clearPendingEditSoundEntry();
    if (e.route === 1) return { kind: 'move', track: e.track };
    if (e.route === 0) {
        refreshSchwungCoRunSlotMask(e.track);
        return { kind: 'schwung', track: e.track, slot: e.slot };
    }
    return null;
}
