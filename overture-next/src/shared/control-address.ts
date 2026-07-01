/**
 * The address of a single physical control on the Move surface — the trigger a
 * press would hit. Neutral input addressing shared by control affordances
 * (which name a trigger) and view projection (which maps a trigger to a feedback
 * region). Kind-tagged so more control types can be added as they gain
 * affordances.
 */
export type ControlAddress = { kind: "track-button"; row: number };
