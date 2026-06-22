/* Auto-route overlay — the full-screen "Configuring / routing…" takeover shown
 * while the blind front-panel gesture macro drives Move's routing menu. Owns the
 * OLED (top-priority branch in drawUIImpl) so the user sees a stable message and
 * not the menu flicker the macro is driving. Draws through the render surface
 * (clear_screen + print), matching the other prompt/overlay render modules. */

/* 6px-per-glyph centering, matching renderTrackActionPopup's title math. */
function centerX(text) {
    return Math.floor((128 - text.length * 6) / 2);
}

/**
 * @param {{ clear_screen: () => void, print: (x: number, y: number, text: string, color: number) => void }} deps
 * @returns {void}
 */
export function renderAutoRouteOverlay(deps) {
    deps.clear_screen();
    const title = 'Configuring';
    const sub = 'routing...';
    deps.print(centerX(title), 22, title, 1);
    deps.print(centerX(sub), 36, sub, 1);
}
