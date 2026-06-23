function truncText(text, maxLen) {
    text = String(text || '');
    maxLen = maxLen | 0;
    return text.length > maxLen ? text.slice(0, Math.max(0, maxLen - 1)) + '...' : text;
}

function centerX(text) {
    return Math.max(0, Math.floor((128 - String(text || '').length * 6) / 2));
}

function renderButton(surface, x, y, w, h, selected, label) {
    const labelX = x + Math.max(1, Math.floor((w - String(label || '').length * 6) / 2));
    if (selected) {
        surface.fill_rect(x, y, w, h, 1);
        surface.print(labelX, y + 3, label, 0);
    } else {
        surface.fill_rect(x, y, w, 1, 1);
        surface.fill_rect(x, y + h - 1, w, 1, 1);
        surface.fill_rect(x, y, 1, h, 1);
        surface.fill_rect(x + w - 1, y, 1, h, 1);
        surface.print(labelX, y + 3, label, 1);
    }
}

export function createConfirmPrompt(opts) {
    opts = opts || {};
    return {
        title: String(opts.title || 'Confirm'),
        message: String(opts.message || ''),
        cancelLabel: String(opts.cancelLabel || 'No'),
        confirmLabel: String(opts.confirmLabel || 'Yes'),
        selected: opts.defaultConfirm ? 1 : 0,
        payload: opts.payload || null
    };
}

export function rotateConfirmPrompt(prompt, delta) {
    if (!prompt || delta === 0) return false;
    prompt.selected = prompt.selected ? 0 : 1;
    return true;
}

export function confirmPromptAction(prompt) {
    if (!prompt) return 'none';
    return prompt.selected ? 'confirm' : 'cancel';
}

export function renderConfirmPrompt(surface, prompt) {
    if (!surface || !prompt) return false;
    surface.clear_screen();
    const title = truncText(prompt.title, 20);
    const message = truncText(prompt.message, 20);
    surface.print(centerX(title), 3, title, 1);
    surface.fill_rect(0, 13, 128, 1, 1);
    if (message) surface.print(centerX(message), 24, message, 1);
    renderButton(surface, 10, 47, 46, 13, prompt.selected === 0, prompt.cancelLabel);
    renderButton(surface, 72, 47, 46, 13, prompt.selected === 1, prompt.confirmLabel);
    return true;
}
