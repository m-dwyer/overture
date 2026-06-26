export const DEFAULT_STEP_COUNT = 16;

export interface PatternStep {
  index: number;
  active: boolean;
  note: number;
  velocity: number;
  gateTicks: number;
}

export interface Pattern {
  length: number;
  steps: PatternStep[];
}

export function createDefaultPattern(stepCount = DEFAULT_STEP_COUNT, gateTicks = 12): Pattern {
  const steps = Array.from({ length: stepCount }, (_, index) => ({
    index,
    active: index % 4 === 0,
    note: 60 + (index % 8),
    velocity: 100,
    gateTicks,
  }));
  return { length: stepCount, steps };
}

export function getPatternStep(pattern: Pattern, index: number): PatternStep | null {
  return pattern.steps[index] ?? null;
}

export function togglePatternStep(pattern: Pattern, index: number): PatternStep | null {
  const step = getPatternStep(pattern, index);
  if (!step) return null;
  step.active = !step.active;
  return step;
}
