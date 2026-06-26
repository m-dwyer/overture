export interface UiContextJogEvent {
    type: 'click' | 'rotate';
    delta?: number;
}

export interface UiContext {
    id?: string;
    render?: (surface: any) => boolean | void;
    handleJog?: (event: UiContextJogEvent, stack: UiContextStack) => boolean | void;
    handleBack?: (stack: UiContextStack) => boolean | void;
}

export interface UiContextStack {
    push(context: UiContext): UiContext;
    pop(expected?: UiContext): UiContext | null;
    top(): UiContext | null;
    size(): number;
    clear(): void;
    renderActive(surface: any): boolean;
    handleJog(event: UiContextJogEvent): boolean;
    handleBack(): boolean;
}

/**
 * Temporary UI ownership stack for modal-style surfaces.
 *
 * Context Object contract:
 * - Represents one temporary blocking surface, such as a confirm prompt.
 * - Gets first refusal only while it is on top of the stack.
 * - Returns true only when it consumes render/input/exit handling.
 * - Owns temporary UI priority, not domain state.
 * - Leaves domain commit/cancel behavior in the feature module callbacks.
 * - Is not a generic screen router for Track View, Session View, Sound Page,
 *   co-run, or other base groovebox surfaces.
 *
 * Contexts are intentionally plain objects. The stack owns ordering and fallback
 * behavior; feature modules keep the commit/cancel behavior they already own.
 */
export function createUiContextStack(): UiContextStack {
    const stack: UiContext[] = [];
    const api: UiContextStack = {
        push: function(context: UiContext): UiContext {
            stack.push(context);
            return context;
        },
        pop: function(expected?: UiContext): UiContext | null {
            if (!stack.length) return null;
            if (expected && stack[stack.length - 1] !== expected) return null;
            return stack.pop() || null;
        },
        top: function(): UiContext | null {
            return stack.length ? stack[stack.length - 1] : null;
        },
        size: function(): number {
            return stack.length;
        },
        clear: function(): void {
            stack.length = 0;
        },
        renderActive: function(surface: any): boolean {
            const context = api.top();
            if (!context || typeof context.render !== 'function') return false;
            return context.render(surface) !== false;
        },
        handleJog: function(event: UiContextJogEvent): boolean {
            const context = api.top();
            if (!context || typeof context.handleJog !== 'function') return false;
            return context.handleJog(event, api) === true;
        },
        handleBack: function(): boolean {
            const context = api.top();
            if (!context || typeof context.handleBack !== 'function') return false;
            return context.handleBack(api) === true;
        }
    };
    return api;
}
