import { dlog } from '../core/ui_debug_log.mjs';
import {
    presetScope,
    selectedComponent,
    selectedModule
} from './ui_sound_preset_scope.mjs';

export function listSchwungModuleFactoryPresets(components, page) {
    if (!page || page.slot < 0 || typeof shadow_get_param !== 'function') return [];
    const component = selectedComponent(components, page);
    const module = selectedModule(page);
    const scope = presetScope(component, module);
    if (!scope) return [];
    const rawCount = shadow_get_param(page.slot | 0, scope.prefix + ':preset_count');
    const count = Math.max(0, parseInt(rawCount, 10) || 0);
    if (count <= 0) return [];
    const current = parseInt(shadow_get_param(page.slot | 0, scope.prefix + ':preset'), 10);
    const currentName = shadow_get_param(page.slot | 0, scope.prefix + ':preset_name') || '';
    const items = [];
    for (let i = 0; i < count; i++) {
        const isCurrent = Number.isFinite(current) && i === current;
        const indexLabel = String(i + 1).padStart(2, '0');
        const indexedName = shadow_get_param(page.slot | 0, scope.prefix + ':preset_name_' + i) || '';
        const name = indexedName || (isCurrent ? currentName : '') || indexLabel;
        items.push({
            kind: 'item',
            factoryPreset: true,
            name,
            index: i,
            componentPrefix: scope.prefix,
            moduleId: scope.moduleId
        });
    }
    return items;
}

export function loadSchwungModuleFactoryPreset(components, page, entry) {
    if (!page || page.slot < 0 || !entry || !entry.factoryPreset || typeof shadow_set_param !== 'function')
        return { ok: false, reason: 'No load' };
    const component = selectedComponent(components, page);
    const module = selectedModule(page);
    const scope = presetScope(component, module);
    if (!scope || entry.componentPrefix !== scope.prefix || entry.moduleId !== scope.moduleId)
        return { ok: false, reason: 'Wrong module' };
    const index = Math.max(0, parseInt(entry.index, 10) || 0);
    shadow_set_param(page.slot | 0, scope.prefix + ':preset', String(index));
    const appliedName = typeof shadow_get_param === 'function'
        ? (shadow_get_param(page.slot | 0, scope.prefix + ':preset_name') || '')
        : '';
    OVERTURE_DEBUG_LOG && dlog('INFO', 'sound-preset factory-load scope=' + scope.scope
        + ' index=' + index + ' name=' + appliedName);
    return { ok: true, preset: Object.assign({}, entry, { appliedName }) };
}
