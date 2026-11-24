import { explained, quantity, type Explained, type Explanation } from '../explain';
import {
  externalLoadForTotal,
  roundToAchievable,
  roundingExplanation,
  type BodyweightImplements,
  type Implement,
  type Rounding,
} from '../loading';
import type { Mass, RoundingMode } from '../units';
import { curveParams, curvePct, type CurveRules } from './curves';
import { effectiveReps, type BiasRules } from './effort';
import type { E1rmExercise } from './estimate';

/**
 * Load for a target (PRG-05, §8.7.4): load = e1RM × pct(target reps + target RIR), rounded to
 * the user's equipment. The RIR bias applies in both directions, so this is the inverse of the
 * set estimate: a set lifted at the suggested load and reported at the target RIR reproduces the
 * e1RM (up to rounding).
 */

export type TargetRules = CurveRules & BiasRules;

export interface LoadTargetInput {
  readonly e1rmKg: number;
  readonly reps: number;
  readonly rir: number;
  readonly exercise: E1rmExercise;
  /** Required for bodyweight-loaded exercises. */
  readonly bodyweightKg?: number | null;
}

export interface TargetEquipment {
  /** Bar and plates, dumbbells, stack… for external loads. */
  readonly implement?: Implement;
  /** Added-load and assistance implements of bodyweight-loaded exercises. */
  readonly bodyweight?: BodyweightImplements;
  readonly mode?: RoundingMode;
}

export interface LoadTarget {
  /** e1RM × pct, before rounding (bodyweight-loaded: bodyweight + external). */
  readonly totalKg: number;
  readonly reff: number;
  readonly pct: number;
  /** The suggested load to put on the implement (negative: assistance). */
  readonly load: Mass;
  readonly rounding: Rounding | null;
}

export function loadForTarget(
  input: LoadTargetInput,
  equipment: TargetEquipment,
  rules: TargetRules,
): Explained<LoadTarget | null> {
  const reff = effectiveReps(input.reps, input.rir, rules);
  const pct = curvePct(input.exercise.curveClass, reff, rules);
  const params = [...curveParams(input.exercise.curveClass, rules), rules['load.rirBias']];
  const facts = [
    quantity('e1rmKg', input.e1rmKg),
    quantity('targetReps', input.reps),
    quantity('targetRir', input.rir),
  ];
  const bodyweightMissing = input.bodyweightKg === undefined || input.bodyweightKg === null;
  if (pct === null || (input.exercise.bodyweightLoaded && bodyweightMissing)) {
    return explained(null, 'e1rm.loadForTarget', { args: { reff }, facts, params });
  }

  const totalKg = input.e1rmKg * pct;
  const mode = equipment.mode ?? 'nearestTiesDown';
  let load: Mass;
  let rounding: Rounding | null = null;
  if (input.exercise.bodyweightLoaded) {
    const external = externalLoadForTotal(
      totalKg,
      input.bodyweightKg ?? 0,
      equipment.bodyweight ?? {},
      mode,
    );
    ({ load, rounding } = external);
    facts.push(quantity('bodyweightKg', input.bodyweightKg ?? null));
  } else if (equipment.implement) {
    rounding = roundToAchievable({ value: totalKg, unit: 'kg' }, equipment.implement, mode);
    load = { value: rounding.chosen?.load ?? rounding.target, unit: rounding.unit };
  } else {
    load = { value: totalKg, unit: 'kg' };
  }

  const children: Explanation[] = rounding ? [roundingExplanation(rounding)] : [];
  return explained({ totalKg, reff, pct, load, rounding }, 'e1rm.loadForTarget', {
    args: { reff, pct, total: { mass: { value: totalKg, unit: 'kg' } }, load: { mass: load } },
    facts,
    params,
    children,
  });
}
