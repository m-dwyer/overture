export const DEFAULT_STEP_COUNT = 16;

export interface SequenceStep {
  index: number;
  active: boolean;
  note: number;
  velocity: number;
  gateTicks: number;
}

export interface Sequence {
  length: number;
  steps: SequenceStep[];
}

export function createDefaultSequence(stepCount = DEFAULT_STEP_COUNT, gateTicks = 12): Sequence {
  const steps = Array.from({ length: stepCount }, (_, index) => ({
    index,
    active: index % 4 === 0,
    note: 60 + (index % 8),
    velocity: 100,
    gateTicks,
  }));
  return { length: stepCount, steps };
}

export function getSequenceStep(sequence: Sequence, index: number): SequenceStep | null {
  return sequence.steps[index] ?? null;
}

export interface SequenceStepToggle {
  sequence: Sequence;
  step: SequenceStep;
}

export function sequenceWithToggledStep(sequence: Sequence, index: number): SequenceStepToggle | null {
  const step = getSequenceStep(sequence, index);
  if (!step) return null;
  const toggledStep = { ...step, active: !step.active };
  return {
    sequence: {
      ...sequence,
      steps: sequence.steps.map((candidate) => (candidate.index === index ? toggledStep : candidate)),
    },
    step: toggledStep,
  };
}
