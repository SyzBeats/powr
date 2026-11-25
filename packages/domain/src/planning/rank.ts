import { explain, explained, type Explained, type Explanation, type RuleId } from '../explain';
import type { MuscleId } from '../ids';
import type { ExerciseDef } from '../model';
import type { RuleSlice } from '../rules';
import { parentMuscle } from '../volume';
import { creditFor, evidenceFor, isGroup } from './credits';

export type RankingRules = RuleSlice<'ranking.effectiveness'>;

/**
 * MAP-03 effectiveness of an exercise for one muscle, 0…1: the weighted sum of (a) its credit for
 * the muscle, (b) the evidence strength of that mapping (H > EMG > C), (c) stretch emphasis, (d)
 * suitability for progressive overload and (e) sub-region coverage. Weights are registry data
 * (`ranking.effectiveness`, [INF]). Custom exercises are unrated beyond their credit unless the
 * user rated them (EXL-04: then stretch emphasis, overload and sub-regions count; evidence is C).
 * Each factor's contribution is a child explanation, for the "Why?" sheet.
 */
export function effectiveness(
  exercise: ExerciseDef,
  muscle: MuscleId,
  rules: RankingRules,
): Explained<number> {
  const param = rules['ranking.effectiveness'];
  const { weights, evidenceScore } = param.value;
  const credit = creditFor(exercise, muscle);
  const rated = credit > 0 && (!exercise.custom || exercise.userRated === true);
  const evidence = evidenceFor(exercise, muscle);
  const factors = {
    credit,
    evidence: rated && evidence ? evidenceScore[evidence] : 0,
    stretch: rated && exercise.defaults.stretchEmphasis ? 1 : 0,
    overload: rated ? exercise.ranking.overloadSuitability / 3 : 0,
    subRegion: rated && coversSubRegion(exercise, muscle) ? 1 : 0,
  };
  const score =
    weights.credit * factors.credit +
    weights.evidence * factors.evidence +
    weights.stretch * factors.stretch +
    weights.overload * factors.overload +
    weights.subRegion * factors.subRegion;
  return explained(score, 'ranking.effectiveness', {
    args: { exercise: exercise.id, muscle, score, evidence: evidence ?? 'none' },
    params: [param],
    children: [
      child('ranking.factor.credit', factors.credit, weights.credit),
      child('ranking.factor.evidence', factors.evidence, weights.evidence),
      child('ranking.factor.stretch', factors.stretch, weights.stretch),
      child('ranking.factor.overload', factors.overload, weights.overload),
      child('ranking.factor.subRegion', factors.subRegion, weights.subRegion),
    ],
  });
}

function child(rule: RuleId, value: number, weight: number): Explanation {
  return explain(rule, { args: { value, weight, contribution: value * weight } });
}

/**
 * The tie-break after equal scores (M5z, product owner 2026-11-25): the standard variant of a
 * movement first (`ranking.standard`), so the common choice wins over a specialised one with the
 * same score (the dumbbell shoulder press over the Arnold press); callers break the remaining ties
 * by ID. Used by the slot ranking (generator, next block, substitutes, session alternatives) and
 * the body map's muscle ranking.
 */
export function compareStandard(a: ExerciseDef, b: ExerciseDef): number {
  return Number(b.ranking.standard === true) - Number(a.ranking.standard === true);
}

/** A slot's score for a candidate: the mean effectiveness over the slot's target muscles. */
export function slotScore(
  exercise: ExerciseDef,
  targets: readonly MuscleId[],
  rules: RankingRules,
): number {
  if (targets.length === 0) return 0;
  let sum = 0;
  for (const target of targets) sum += effectiveness(exercise, target, rules).value;
  return sum / targets.length;
}

/** MAP-03 (e): the exercise covers the target sub-region, or a sub-region of the target group. */
function coversSubRegion(exercise: ExerciseDef, muscle: MuscleId): boolean {
  const regions = exercise.ranking.subRegions ?? [];
  return isGroup(muscle)
    ? regions.some((region) => parentMuscle(region) === muscle)
    : regions.includes(muscle);
}
