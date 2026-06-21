/* Compatibility DSP operation queue.
 *
 * This intentionally preserves S.pendingDefaultSetParams as the backing queue
 * and the legacy one-per-tick drain policy. First-wave migrations should route
 * only selected DSP write families through these helpers while existing
 * producers keep their current push/unshift behavior.
 */

export function enqueueDspOperation(S, op) {
    S.pendingDefaultSetParams.push(op);
}

export function enqueuePriorityDspOperation(S, op) {
    S.pendingDefaultSetParams.unshift(op);
}

export function holdDspOperationDrain(S, ticks) {
    S.clearDrainHold = ticks;
}

export function drainNextDspOperation(S, deps) {
    if (S.clearDrainHold > 0) {
        S.clearDrainHold--;
        return;
    }
    if (S.pendingDefaultSetParams.length === 0) return;
    if (S.pendingSetLoad) return;
    if (S.pendingDspSync !== 0) return;
    if (typeof deps.host_module_set_param !== 'function') return;

    const op = S.pendingDefaultSetParams.shift();
    deps.host_module_set_param(op.key, op.val);
}
