import { OVERTURE_HOME } from './ui_constants.mjs';
import { dlog } from './ui_debug_log.mjs';
import {
    clampComponentIndex,
    selectedParamList
} from './ui_sound_edit_model.mjs';

const SOUND_PRESET_DIR = OVERTURE_HOME + '/sound_presets';
const SOUND_PRESET_MANIFEST = SOUND_PRESET_DIR + '/manifest.json';
const MANIFEST_VERSION = 1;

function nowMs() {
    return (typeof Date !== 'undefined' && Date.now) ? Date.now() : 0;
}

function ensurePresetDir() {
    if (typeof host_ensure_dir !== 'function') return false;
    return !!(host_ensure_dir(OVERTURE_HOME) && host_ensure_dir(SOUND_PRESET_DIR));
}

function parseJson(raw, fallback) {
    if (!raw) return fallback;
    try { return JSON.parse(raw); } catch (_e) { return fallback; }
}

function readManifest() {
    if (typeof host_read_file !== 'function') return { v: MANIFEST_VERSION, presets: [] };
    const obj = parseJson(host_read_file(SOUND_PRESET_MANIFEST), null);
    if (!obj || !Array.isArray(obj.presets)) return { v: MANIFEST_VERSION, presets: [] };
    return { v: obj.v || MANIFEST_VERSION, presets: obj.presets };
}

function writeManifest(manifest) {
    if (!ensurePresetDir() || typeof host_write_file !== 'function') return false;
    return !!host_write_file(SOUND_PRESET_MANIFEST, JSON.stringify({
        v: MANIFEST_VERSION,
        presets: manifest.presets || []
    }, null, 2) + '\n');
}

function sanitizeFilePart(value) {
    value = String(value || 'preset').toLowerCase();
    value = value.replace(/[^a-z0-9._-]+/g, '_').replace(/^_+|_+$/g, '');
    return value || 'preset';
}

function componentPrefix(component) {
    if (!component || !component.param) return '';
    return component.param.replace(':module', '');
}

function selectedModule(page) {
    const idx = clampComponentIndex(page && page.selectedIndex);
    return page && page.modules ? page.modules[idx] : null;
}

function selectedComponent(components, page) {
    return components[clampComponentIndex(page && page.selectedIndex)];
}

function presetScope(component, module) {
    const prefix = componentPrefix(component);
    if (!prefix || !module || !module.id) return null;
    return { prefix, moduleId: String(module.id), scope: prefix + '/' + String(module.id) };
}

function uniquePresetId(scope, name, ts) {
    return sanitizeFilePart(scope.replace('/', '_')) + '-' + sanitizeFilePart(name) + '-' + String(ts || nowMs());
}

function presetFile(id) {
    return SOUND_PRESET_DIR + '/' + sanitizeFilePart(id) + '.json';
}

function defaultPresetName() {
    return 'Preset';
}

function captureParams(slot, params) {
    const out = {};
    if (typeof shadow_get_param !== 'function') return out;
    for (let i = 0; i < params.length; i++) {
        const p = params[i];
        if (!p || !p.prefix || !p.key) continue;
        const value = shadow_get_param(slot | 0, p.prefix + ':' + p.key);
        if (value !== null && value !== undefined && value !== '') out[p.key] = String(value);
    }
    return out;
}

export function suggestedSchwungSoundPresetName(components, page) {
    const base = defaultPresetName(selectedModule(page));
    const presets = listSchwungSoundPresets(components, page);
    for (let i = 1; i < 1000; i++) {
        const candidate = base + ' ' + i;
        let used = false;
        for (let j = 0; j < presets.length; j++) {
            if (presets[j] && presets[j].name === candidate) {
                used = true;
                break;
            }
        }
        if (!used) return candidate;
    }
    return base;
}

export function listSchwungSoundPresets(components, page) {
    const component = selectedComponent(components, page);
    const module = selectedModule(page);
    const scope = presetScope(component, module);
    if (!scope) return [];
    const manifest = readManifest();
    return manifest.presets
        .filter(function(p) {
            return p && p.scope === scope.scope && p.componentPrefix === scope.prefix && p.moduleId === scope.moduleId;
        })
        .sort(function(a, b) { return (b.ts || 0) - (a.ts || 0); });
}

export function saveSchwungSoundPreset(components, page, name) {
    if (!page || page.slot < 0 || typeof host_write_file !== 'function') return { ok: false, reason: 'No write' };
    const component = selectedComponent(components, page);
    const module = selectedModule(page);
    const scope = presetScope(component, module);
    name = String(name || '').trim();
    if (!scope || !name) return { ok: false, reason: 'No module' };

    const ts = nowMs();
    const manifest = readManifest();
    const existing = manifest.presets.find(function(p) {
        return p && p.scope === scope.scope && p.name === name;
    });
    const id = existing ? existing.id : uniquePresetId(scope.scope, name, ts);
    const file = existing ? existing.file : presetFile(id);
    const prefix = scope.prefix;
    const params = selectedParamList(page);
    const preset = {
        v: 1,
        id,
        name,
        ts,
        componentPrefix: prefix,
        componentLabel: component.label || '',
        moduleId: scope.moduleId,
        moduleName: module.name || scope.moduleId,
        state: '',
        params: captureParams(page.slot, params)
    };
    OVERTURE_DEBUG_LOG && dlog('DEBUG', 'sound-preset save start slot=' + (page.slot | 0)
        + ' scope=' + scope.scope + ' name=' + name + ' paramCount=' + Object.keys(preset.params).length);

    if (typeof shadow_get_param === 'function') {
        const state = shadow_get_param(page.slot | 0, prefix + ':state');
        if (state !== null && state !== undefined && state !== '') preset.state = String(state);
    }

    if (!ensurePresetDir()) return { ok: false, reason: 'No dir' };
    if (!host_write_file(file, JSON.stringify(preset, null, 2) + '\n')) return { ok: false, reason: 'Save failed' };

    const nextEntry = {
        id,
        name,
        ts,
        scope: scope.scope,
        componentPrefix: prefix,
        moduleId: scope.moduleId,
        moduleName: module.name || scope.moduleId,
        file
    };
    const filtered = manifest.presets.filter(function(p) { return p && p.id !== id; });
    filtered.unshift(nextEntry);
    manifest.presets = filtered;
    if (!writeManifest(manifest)) return { ok: false, reason: 'Index failed' };
    OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-preset save ok id=' + id + ' file=' + file);
    return { ok: true, preset: nextEntry };
}

export function loadSchwungSoundPreset(components, page, entry) {
    if (!page || page.slot < 0 || !entry || typeof host_read_file !== 'function' || typeof shadow_set_param !== 'function')
        return { ok: false, reason: 'No load' };
    const component = selectedComponent(components, page);
    const module = selectedModule(page);
    const scope = presetScope(component, module);
    if (!scope || entry.componentPrefix !== scope.prefix || entry.moduleId !== scope.moduleId)
        return { ok: false, reason: 'Wrong module' };
    const preset = parseJson(host_read_file(entry.file), null);
    if (!preset || preset.moduleId !== scope.moduleId || preset.componentPrefix !== scope.prefix)
        return { ok: false, reason: 'Bad preset' };

    const params = preset.params || {};
    const keys = Object.keys(params);
    OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-preset load start slot=' + (page.slot | 0)
        + ' scope=' + scope.scope + ' name=' + (preset.name || entry.name || '')
        + ' keys=' + keys.length + ' stateFallback=' + (preset.state && keys.length === 0 ? 1 : 0));
    if (preset.state && keys.length === 0) shadow_set_param(page.slot | 0, scope.prefix + ':state', String(preset.state));
    for (let i = 0; i < keys.length; i++) {
        OVERTURE_DEBUG_LOG && dlog('DEBUG', 'sound-preset set ' + scope.prefix + ':' + keys[i] + '=' + String(params[keys[i]]));
        shadow_set_param(page.slot | 0, scope.prefix + ':' + keys[i], String(params[keys[i]]));
    }
    OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-preset load ok keys=' + keys.length);
    return { ok: true, preset };
}
