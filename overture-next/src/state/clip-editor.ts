import type { Sequence, SequenceStep } from "../domain/sequence";

/**
 * A short-lived editing capability over one Overture Clip's Sequence. Vended by
 * {@link OvertureProject.clipEditorAt} against the active Selected Clip Cell, it
 * concentrates per-Step edit verbs and delegates to the owning Sequence entity.
 *
 * It is not stored and never surfaces the live Sequence, so every Clip-content
 * edit stays funnelled through the Project aggregate. Edit verbs return a copied
 * Step rather than the live one, so callers cannot reach back into Project state.
 */
export class ClipEditor {
  private readonly sequence: Sequence;

  private constructor(sequence: Sequence) {
    this.sequence = sequence;
  }

  static for(sequence: Sequence): ClipEditor {
    return new ClipEditor(sequence);
  }

  /**
   * Toggles the Step at stepIndex on the Clip's Sequence and returns a copy of
   * the updated Step, or null when the Step Index is out of range.
   */
  toggleStep(stepIndex: number): Readonly<SequenceStep> | null {
    const step = this.sequence.toggleStep(stepIndex);
    return step ? { ...step } : null;
  }
}
