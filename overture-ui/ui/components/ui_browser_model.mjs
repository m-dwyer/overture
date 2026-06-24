export function createBrowserItem(name, payload) {
    return Object.assign({ kind: 'item', name: String(name || '') }, payload || {});
}

export function createBrowserDivider(name) {
    return { kind: 'divider', divider: true, name: String(name || '') };
}

export function isSelectableBrowserItem(item) {
    return !!item && item.kind !== 'divider' && item.kind !== 'empty' && !item.divider;
}

export function firstSelectableBrowserIndex(items) {
    for (let i = 0; i < items.length; i++) {
        if (isSelectableBrowserItem(items[i])) return i;
    }
    return 0;
}

export function nextSelectableBrowserIndex(items, from, delta) {
    const n = items ? items.length : 0;
    if (n <= 0) return 0;
    const step = delta >= 0 ? 1 : -1;
    let idx = Math.max(0, Math.min(n - 1, from | 0));
    for (let guard = 0; guard < n; guard++) {
        const next = idx + step;
        if (next < 0 || next >= n) return idx;
        idx = next;
        if (isSelectableBrowserItem(items[idx])) return idx;
    }
    return idx;
}
