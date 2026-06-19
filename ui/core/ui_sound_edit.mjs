import { S } from './ui_state.mjs';
import {
    EDIT_SOUND_PREFLIGHT_TICKS,
    describeEditSoundForTrack,
    editSoundSlotLabel,
    schSlotsForTrack
} from './ui_routes.mjs';

export const SCHWUNG_SOUND_COMPONENTS = [
    { label: 'MIDI FX', param: 'midi_fx1:module', read: 'midi_fx1_module', list: 'midi_fx' },
    { label: 'Synth',   param: 'synth:module',    read: 'synth_module',    list: 'sound_generator' },
    { label: 'FX 1',    param: 'fx1:module',      read: 'fx1_module',      list: 'audio_fx' },
    { label: 'FX 2',    param: 'fx2:module',      read: 'fx2_module',      list: 'audio_fx' },
    { label: 'Deep Edit', param: '', read: '', list: '' }
];

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

function clampComponentIndex(idx) {
    idx = idx | 0;
    if (idx < 0) return 0;
    if (idx >= SCHWUNG_SOUND_COMPONENTS.length) return SCHWUNG_SOUND_COMPONENTS.length - 1;
    return idx;
}

function normalizeModuleName(v) {
    if (v == null) return '--';
    v = String(v);
    return v.length ? v : '--';
}

function readSchwungModuleName(slot, component) {
    if ((slot | 0) < 0 || !component || !component.read) return '--';
    if (typeof globalThis.shadow_get_param !== 'function') return '--';
    return normalizeModuleName(globalThis.shadow_get_param(slot | 0, component.read));
}

function currentModuleIdForComponent(page, component) {
    if (!page || !component || !component.read) return '';
    const v = readSchwungModuleName(page.slot, component);
    return v === '--' ? '' : v;
}

export function refreshSchwungSoundPageModules() {
    const page = S.schwungSoundPage;
    if (!page) return;
    page.names = SCHWUNG_SOUND_COMPONENTS.map(function(c) {
        return c.read ? readSchwungModuleName(page.slot, c) : '';
    });
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
        browserItems: [],
        browserIndex: 0,
        noList: false,
        names: []
    };
    refreshSchwungSoundPageModules();
}

export function closeSchwungSoundPage() {
    if (!S.schwungSoundPage) return false;
    S.schwungSoundPage = null;
    S.screenDirty = true;
    return true;
}

function normalizeModuleList(list) {
    if (typeof list === 'string') {
        try { list = JSON.parse(list); } catch (_e) {
            list = list.split('\n').map(function(s) { return s.trim(); }).filter(Boolean);
        }
    }
    if (!Array.isArray(list)) return [];
    return list.map(function(item) {
        if (typeof item === 'string') return { id: item, name: item };
        if (!item) return null;
        const id = item.id || item.module || item.name || item.path;
        if (!id) return null;
        return { id: String(id), name: String(item.name || id), component_type: item.component_type || item.type || '' };
    }).filter(Boolean);
}

function filterHostModulesForComponent(componentType) {
    if (typeof globalThis.host_list_modules !== 'function') return null;
    return normalizeModuleList(globalThis.host_list_modules()).filter(function(item) {
        return item.component_type === componentType;
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
        page.browserItems = normalizeModuleList(
            globalThis.shadow_list_modules_for_component(component.list)
        );
    } else {
        const hostItems = filterHostModulesForComponent(component.list);
        if (hostItems === null) {
            page.browser = true;
            page.browserItems = [];
            page.browserIndex = 0;
            page.noList = true;
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
        page.browserIndex = 0;
        page.noList = true;
        S.screenDirty = true;
        return true;
    }
    page.browser = true;
    const currentId = currentModuleIdForComponent(page, component);
    const currentIndex = currentId
        ? page.browserItems.findIndex(function(item) { return item.id === currentId; })
        : -1;
    page.browserIndex = currentIndex >= 0 ? currentIndex : 0;
    page.noList = page.browserItems.length === 0;
    S.screenDirty = true;
    return true;
}

export function applySchwungSoundBrowserSelection() {
    const page = S.schwungSoundPage;
    if (!page || !page.browser || page.slot < 0 || page.noList) return false;
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
    page.browserItems = [];
    page.browserIndex = 0;
    page.noList = false;
    refreshSchwungSoundPageModules();
    return true;
}

export function rotateSchwungSoundPage(delta) {
    const page = S.schwungSoundPage;
    if (!page || delta === 0) return false;
    if (page.browser) {
        const n = page.browserItems.length;
        if (n > 0) page.browserIndex = Math.max(0, Math.min(n - 1, (page.browserIndex | 0) + delta));
    } else {
        page.selectedIndex = clampComponentIndex((page.selectedIndex | 0) + delta);
    }
    S.screenDirty = true;
    return true;
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
        const component = SCHWUNG_SOUND_COMPONENTS[clampComponentIndex(page.selectedIndex)];
        surface.print(0, 0, component.label, 1);
        if (page.noList) {
            surface.print(0, 18, 'NO LIST', 1);
            surface.print(0, 32, 'Needs Schwung hook', 1);
            return true;
        }
        const start = Math.max(0, Math.min(page.browserIndex | 0, Math.max(0, page.browserItems.length - 3)));
        for (let i = 0; i < 3; i++) {
            const idx = start + i;
            if (idx >= page.browserItems.length) break;
            surface.print(0, 16 + i * 14, (idx === page.browserIndex ? '>' : ' ') + page.browserItems[idx].name, 1);
        }
        return true;
    }
    surface.print(0, 0, 'SOUND T' + (page.track + 1) + ' ' + editSoundSlotLabel(page.slot), 1);
    const start = Math.max(0, Math.min(page.selectedIndex | 0, SCHWUNG_SOUND_COMPONENTS.length - 4));
    for (let i = 0; i < 4; i++) {
        const idx = start + i;
        const c = SCHWUNG_SOUND_COMPONENTS[idx];
        const prefix = idx === page.selectedIndex ? '>' : ' ';
        const name = page.names && page.names[idx] ? page.names[idx] : '--';
        const value = c.read ? (' ' + name) : '';
        surface.print(0, 14 + i * 12, prefix + c.label + value, 1);
    }
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
