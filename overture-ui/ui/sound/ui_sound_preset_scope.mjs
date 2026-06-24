import {
    clampComponentIndex
} from './ui_sound_page_model.mjs';

export function componentPrefix(component) {
    if (!component || !component.param) return '';
    return component.param.replace(':module', '');
}

export function selectedModule(page) {
    const idx = clampComponentIndex(page && page.selectedIndex);
    return page && page.modules ? page.modules[idx] : null;
}

export function selectedComponent(components, page) {
    return components[clampComponentIndex(page && page.selectedIndex)];
}

export function presetScope(component, module) {
    const prefix = componentPrefix(component);
    if (!prefix || !module || !module.id) return null;
    return { prefix, moduleId: String(module.id), scope: prefix + '/' + String(module.id) };
}
