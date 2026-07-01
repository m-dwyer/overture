import { integerInRange, type Branded } from "./value-objects";

export const DEFAULT_STEP_COUNT = 16;

export type StepIndex = Branded<number, "StepIndex">;

export interface SequenceStep {
  index: StepIndex;
  active: boolean;
  note: number;
  velocity: number;
  gateTicks: number;
}

/**
 * Read-only Sequence shape exposed to consumers that derive playback or view
 * state. It lets callers inspect route-neutral Step data without receiving a
 * mutation handle for Project-owned Sequence storage. Both a live {@link Sequence}
 * entity and a plain snapshot satisfy this contract.
 */
export interface SequenceReadModel {
  readonly length: number;
  readonly steps: readonly Readonly<SequenceStep>[];
}

export function stepIndex(
  value: number,
  stepCount = DEFAULT_STEP_COUNT,
): StepIndex {
  return integerInRange("Step Index", value, stepCount) as StepIndex;
}

export function parseStepIndex(
  value: number,
  stepCount = DEFAULT_STEP_COUNT,
): StepIndex | null {
  try {
    return stepIndex(value, stepCount);
  } catch {
    return null;
  }
}

export function getSequenceStep(
  sequence: SequenceReadModel,
  index: number,
): Readonly<SequenceStep> | null {
  const parsedIndex = parseStepIndex(index, sequence.steps.length);
  if (parsedIndex === null) return null;
  return sequence.steps[parsedIndex] ?? null;
}

/**
 * Route-neutral musical content for an Overture Clip. A Sequence is an entity
 * that owns its Steps and the Step-level edits performed on them.
 *
 * A Sequence has no independent lifecycle: it is only reachable as the content
 * of a Clip held by {@link OvertureProject}. The Project is the aggregate root
 * that grants access, enforces Clip Cell and occupancy invariants, and never
 * leaks a live Sequence to callers. Consumers that derive playback or view state
 * receive Sequence snapshots, not this instance.
 */
export class Sequence implements SequenceReadModel {
  private readonly stepsValue: SequenceStep[];
  private readonly lengthValue: number;

  private constructor(steps: SequenceStep[], length: number) {
    this.stepsValue = steps;
    this.lengthValue = length;
  }

  static createDefault(
    stepCount = DEFAULT_STEP_COUNT,
    gateTicks = 12,
  ): Sequence {
    const steps = Array.from({ length: stepCount }, (_, index) => ({
      index: stepIndex(index, stepCount),
      active: index % 4 === 0,
      note: 60 + (index % 8),
      velocity: 100,
      gateTicks,
    }));
    return new Sequence(steps, stepCount);
  }

  get length(): number {
    return this.lengthValue;
  }

  get steps(): readonly Readonly<SequenceStep>[] {
    return this.stepsValue;
  }

  /**
   * Toggles one Step's active flag in place and returns the updated Step, or
   * null when the Step Index is out of range. The Sequence owns its Steps; the
   * holding OvertureProject exposes this only through its own Step-edit verb.
   */
  toggleStep(index: number): Readonly<SequenceStep> | null {
    const parsedIndex = parseStepIndex(index, this.stepsValue.length);
    if (parsedIndex === null) return null;
    const step = this.stepsValue[parsedIndex];
    if (!step) return null;
    step.active = !step.active;
    return step;
  }
}

export function createDefaultSequence(
  stepCount = DEFAULT_STEP_COUNT,
  gateTicks = 12,
): Sequence {
  return Sequence.createDefault(stepCount, gateTicks);
}
