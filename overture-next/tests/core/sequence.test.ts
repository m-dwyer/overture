import { describe, expect, test } from "vitest";
import { createDefaultSequence, toggleSequenceStep } from "../../src/core/sequence";

describe("Sequence editing", () => {
  test("toggles Steps through the public Sequence API", () => {
    const sequence = createDefaultSequence();

    expect(sequence.steps[1].active).toBe(false);

    const step = toggleSequenceStep(sequence, 1);

    expect(step).toMatchObject({ index: 1, active: true });
    expect(sequence.steps[1].active).toBe(true);
  });

  test("returns null for out-of-range Step Indexes", () => {
    const sequence = createDefaultSequence();

    expect(toggleSequenceStep(sequence, 99)).toBeNull();
  });
});
