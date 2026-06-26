/**
 * @typedef {Object} UiContextJogEvent
 * @property {'click' | 'rotate'} type
 * @property {number=} delta
 */

/**
 * @typedef {Object} UiContext
 * Context Object contract:
 * - Represents one temporary blocking surface, such as a confirm prompt.
 * - Gets first refusal only while it is on top of the stack.
 * - Returns true only when it consumes render/input/exit handling.
 * - Owns temporary UI priority, not domain state.
 * - Leaves domain commit/cancel behavior in the feature module callbacks.
 * - Is not a generic screen router for Track View, Session View, Sound Page,
 *   co-run, or other base groovebox surfaces.
 *
 * @property {string=} id
 * @property {(surface: any) => boolean | void=} render
 * @property {(event: UiContextJogEvent, stack: UiContextStack) => boolean | void=} handleJog
 * @property {(stack: UiContextStack) => boolean | void=} handleBack
 */

/**
 * @typedef {Object} UiContextStack
 * @property {(context: UiContext) => UiContext} push
 * @property {(expected?: UiContext) => UiContext | null} pop
 * @property {() => UiContext | null} top
 * @property {() => number} size
 * @property {() => void} clear
 * @property {(surface: any) => boolean} renderActive
 * @property {(event: UiContextJogEvent) => boolean} handleJog
 * @property {() => boolean} handleBack
 */

/**
 * Temporary UI ownership stack for modal-style surfaces.
 *
 * Contexts are intentionally plain objects. The stack owns ordering and fallback
 * behavior; feature modules keep the commit/cancel behavior they already own.
 *
 * @returns {UiContextStack}
 */
export function createUiContextStack() {
    /** @type {UiContext[]} */
    const stack = [];
    /** @type {UiContextStack} */
    const api = {
        push: function(context) {
            if (!context) return context;
            stack.push(context);
            return context;
        },
        pop: function(expected) {
            if (!stack.length) return null;
            if (expected && stack[stack.length - 1] !== expected) return null;
            return stack.pop() || null;
        },
        top: function() {
            return stack.length ? stack[stack.length - 1] : null;
        },
        size: function() {
            return stack.length;
        },
        clear: function() {
            stack.length = 0;
        },
        renderActive: function(surface) {
            const context = api.top();
            if (!context || typeof context.render !== 'function') return false;
            return context.render(surface) !== false;
        },
        handleJog: function(event) {
            const context = api.top();
            if (!context || typeof context.handleJog !== 'function') return false;
            return context.handleJog(event, api) === true;
        },
        handleBack: function() {
            const context = api.top();
            if (!context || typeof context.handleBack !== 'function') return false;
            return context.handleBack(api) === true;
        }
    };
    return api;
}
