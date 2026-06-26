import {
    confirmPromptAction,
    renderConfirmPrompt,
    rotateConfirmPrompt
} from '../components/ui_confirm_prompt.mjs';
import type { UiContext } from './ui_context_stack.ts';

export interface ConfirmPromptContextOptions {
    id?: string;
    prompt: any;
    onConfirm?: (prompt: any) => void;
    onCancel?: (prompt: any) => void;
    onClose?: (prompt: any) => void;
    onChange?: () => void;
}

export function createConfirmPromptContext(opts: ConfirmPromptContextOptions = { prompt: null }): UiContext {
    const prompt = opts.prompt;
    const context: UiContext = {
        id: opts.id || 'confirm-prompt',
        render: function(surface: any): boolean {
            return renderConfirmPrompt(surface, prompt);
        },
        handleJog: function(event, stack): boolean {
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
        handleBack: function(stack): boolean {
            stack.pop(context);
            if (opts.onCancel) opts.onCancel(prompt);
            if (opts.onClose) opts.onClose(prompt);
            return true;
        }
    };
    return context;
}
