export function showStatusFlash(target, text, nowTick, durationTicks) {
    if (!target) return false;
    target.statusFlash = {
        text: String(text || ''),
        endTick: (nowTick | 0) + Math.max(1, durationTicks | 0)
    };
    return true;
}

export function activeStatusFlashText(target, nowTick) {
    const flash = target && target.statusFlash;
    if (!flash || !flash.text) return '';
    if ((nowTick | 0) > (flash.endTick | 0)) return '';
    return flash.text;
}

export function expireStatusFlash(target, nowTick) {
    if (!target || !target.statusFlash) return false;
    if ((nowTick | 0) <= (target.statusFlash.endTick | 0)) return false;
    target.statusFlash = null;
    return true;
}
