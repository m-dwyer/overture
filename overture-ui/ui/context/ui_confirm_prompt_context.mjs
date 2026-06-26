import {
    confirmPromptAction,
    renderConfirmPrompt,
    rotateConfirmPrompt
} from '../components/ui_confirm_prompt.mjs';

/**
 * @typedef {Object} ConfirmPromptContextOptions
 * @property {string=} id
 * @property {any} prompt
 * @property {(prompt: any) => void=} onConfirm
 * @property {(prompt: any) => void=} onCancel
 * @property {(prompt: any) => void=} onClose
 * @property {() => void=} onChange
 */

/**
 * @param {ConfirmPromptContextOptions} opts
 * @returns {import('./ui_context_stack.mjs').UiContext}
 */
export function createConfirmPromptContext(opts) {
    opts = opts || { prompt: null };
    const prompt = opts.prompt;
    /** @type {import('./ui_context_stack.mjs').UiContext} */
    const context = {
        id: opts.id || 'confirm-prompt',
        render: function(surface) {
            return renderConfirmPrompt(surface, prompt);
        },
        handleJog: function(event, stack) {
            if (!event) return false;
            if (event.type === 'rotate') {
                if (rotateConfirmPrompt(prompt, event.delta || 0)) {
                    if (opts.onChange) opts.onChange();
                }
                return true;
            }
            if (event.type === 'click') {
                stack.pop(context);
                if (confirmPromptAction(prompt) === 'confirm') {
                    if (opts.onConfirm) opts.onConfirm(prompt);
                } else if (opts.onCancel) {
                    opts.onCancel(prompt);
                }
                if (opts.onClose) opts.onClose(prompt);
                return true;
            }
            return false;
        },
        handleBack: function(stack) {
            stack.pop(context);
            if (opts.onCancel) opts.onCancel(prompt);
            if (opts.onClose) opts.onClose(prompt);
            return true;
        }
    };
    return context;
}
