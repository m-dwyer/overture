import { describe, expect, test } from "vitest";
import { createDefaultSequence, sequenceWithToggledStep } from "../../src/domain/sequence";

describe("Sequence editing", () => {
  test("toggles Steps through the public Sequence API", () => {
    const sequence = createDefaultSequence();

    expect(sequence.steps[1].active).toBe(false);

    const result = sequenceWithToggledStep(sequence, 1);

    expect(result?.step).toMatchObject({ index: 1, active: true });
    expect(result?.sequence.steps[1].active).toBe(true);
    expect(sequence.steps[1].active).toBe(false);
  });

  test("returns null for out-of-range Step Indexes", () => {
    const sequence = createDefaultSequence();

    expect(sequenceWithToggledStep(sequence, 99)).toBeNull();
  });
});
