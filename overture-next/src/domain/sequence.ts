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
 * Route-neutral musical content for an Overture Clip.
 *
 * This type stays in the public domain vocabulary because playback,
 * projection, tests, and Project construction all need to agree on Step
 * semantics without taking route-specific or Project mutation authority.
 * Stored clip Sequences are owned by OvertureProject and should be changed
 * through Project APIs such as toggleSequenceStepAt.
 */
export interface Sequence {
  length: number;
  steps: SequenceStep[];
}

/**
 * Read-only Sequence shape exposed to consumers that derive playback or view
 * state. It lets callers inspect route-neutral Step data without receiving a
 * mutation handle for Project-owned Sequence storage.
 */
export interface SequenceReadModel {
  readonly length: number;
  readonly steps: readonly Readonly<SequenceStep>[];
}

export function stepIndex(value: number, stepCount = DEFAULT_STEP_COUNT): StepIndex {
  return integerInRange("Step Index", value, stepCount) as StepIndex;
}

export function parseStepIndex(value: number, stepCount = DEFAULT_STEP_COUNT): StepIndex | null {
  try {
    return stepIndex(value, stepCount);
  } catch {
    return null;
  }
}

export function createDefaultSequence(stepCount = DEFAULT_STEP_COUNT, gateTicks = 12): Sequence {
  const steps = Array.from({ length: stepCount }, (_, index) => ({
    index: stepIndex(index, stepCount),
    active: index % 4 === 0,
    note: 60 + (index % 8),
    velocity: 100,
    gateTicks,
  }));
  return { length: stepCount, steps };
}

export function getSequenceStep(sequence: SequenceReadModel, index: number): Readonly<SequenceStep> | null {
  const parsedIndex = parseStepIndex(index, sequence.steps.length);
  if (parsedIndex === null) return null;
  return sequence.steps[parsedIndex] ?? null;
}

export interface SequenceStepToggle {
  sequence: Sequence;
  step: SequenceStep;
}

/**
 * Pure Sequence transform for toggling one Step.
 *
 * The returned Sequence is a replacement value; callers that mutate stored
 * Overture Clip data should do so through the owning OvertureProject boundary
 * instead of assigning into Project-owned storage directly.
 */
export function sequenceWithToggledStep(sequence: Sequence, index: number): SequenceStepToggle | null {
  const parsedIndex = parseStepIndex(index, sequence.steps.length);
  if (parsedIndex === null) return null;
  const step = getSequenceStep(sequence, parsedIndex);
  if (!step) return null;
  const toggledStep = { ...step, active: !step.active };
  return {
    sequence: {
      ...sequence,
      steps: sequence.steps.map((candidate) => (candidate.index === parsedIndex ? toggledStep : candidate)),
    },
    step: toggledStep,
  };
}
