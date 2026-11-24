import { explained, type Explained } from '../explain';
import type { RuleSlice, TraineeLevel } from '../rules';

export type ClassificationRules = RuleSlice<
  'progression.classification.slopePctPerWeek' | 'progression.classification.trainingAgeMonths'
>;

/**
 * Trainee level (PRG-10, EB §Progression › Classification): from training age, and once enough
 * weeks of data exist from the observed e1RM slope on the main lifts (≥ 1 %/week novice-like,
 * < 0.25 %/week advanced). The user can override the label.
 */
export function classifyTrainee(
  input: {
    readonly trainingAgeMonths: number;
    readonly slopePctPerWeek: number | null;
    readonly weeksOfData: number;
  },
  rules: ClassificationRules,
): Explained<TraineeLevel> {
  const slope = rules['progression.classification.slopePctPerWeek'];
  const age = rules['progression.classification.trainingAgeMonths'];
  if (input.slopePctPerWeek !== null && input.weeksOfData >= slope.value.minWeeks) {
    const level: TraineeLevel =
      input.slopePctPerWeek >= slope.value.noviceFrom
        ? 'novice'
        : input.slopePctPerWeek < slope.value.advancedBelow
          ? 'advanced'
          : 'intermediate';
    return explained(level, 'progression.level.slope', {
      args: { slopePctPerWeek: input.slopePctPerWeek, weeksOfData: input.weeksOfData },
      params: [slope],
    });
  }
  const level: TraineeLevel =
    input.trainingAgeMonths < age.value.intermediateFrom
      ? 'novice'
      : input.trainingAgeMonths < age.value.advancedFrom
        ? 'intermediate'
        : 'advanced';
  return explained(level, 'progression.level.trainingAge', {
    args: { trainingAgeMonths: input.trainingAgeMonths },
    params: [age],
  });
}
