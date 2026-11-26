/**
 * `@powr/domain/scoring`: powerlifting scores (ANL-07; EB §Scoring). Implemented from the
 * published formulas: IPF Points (IPF formula document, 2019), IPF GL (2020+), DOTS, Wilks and
 * Wilks2020, plus the allometric index kg / BW^0.67. Coefficients and the bodyweight clamps are
 * registry data (the clamps are an app implementation choice, recorded there); no OpenPowerlifting
 * code is used, its unit-test values serve as reference vectors only. Inputs are kg; results are
 * unrounded (display rounds to 2 decimals), except IPF GL, which follows the IPF's 6-decimal
 * rounding of its coefficient and points (rules 1.8.0, T-01). IPF and GL are floored at 0.
 */
import { explained, type Explained } from '../explain';
import type { Param, Polynomial, Range, RuleSlice, ScoreFormula, SexReference } from '../rules';

export type Division = 'classic' | 'equipped';
export type ScoredLift = 'total' | 'squat' | 'bench' | 'deadlift';

export interface ScoreInput {
  readonly sex: SexReference;
  readonly bodyweightKg: number;
  readonly liftedKg: number;
  /** Classic (raw, wraps count as classic) or equipped (single- and multi-ply). */
  readonly division: Division;
  /** What `liftedKg` is: the 3-lift total or a single lift. */
  readonly lift: ScoredLift;
}

export type ScoringRules = RuleSlice<
  | 'scoring.wilks.coefficients'
  | 'scoring.wilks.bodyweightClampKg'
  | 'scoring.wilks2020.coefficients'
  | 'scoring.wilks2020.bodyweightClampKg'
  | 'scoring.dots.coefficients'
  | 'scoring.dots.bodyweightClampKg'
  | 'scoring.ipfPoints.coefficients'
  | 'scoring.ipfPoints.minBodyweightKg'
  | 'scoring.ipfGl.coefficients'
  | 'scoring.ipfGl.minBodyweightKg'
  | 'scoring.allometric.exponent'
>;

/** A score; null where the formula has no coefficients (IPF and GL for squat or deadlift). */
export function score(
  formula: ScoreFormula,
  input: ScoreInput,
  rules: ScoringRules,
): Explained<number | null> {
  if (formula === 'ipfPoints') return ipfPoints(input, rules);
  if (formula === 'ipfGl') return ipfGl(input, rules);
  if (formula === 'allometric') {
    const exponent = rules['scoring.allometric.exponent'];
    const value = input.liftedKg / input.bodyweightKg ** exponent.value;
    return explained(value, 'scoring.allometric', {
      args: { value, exponent: exponent.value },
      params: [exponent],
    });
  }
  // Wilks and DOTS: 500 / polynomial; Wilks2020: 600 / polynomial.
  return polynomialScore(
    `scoring.${formula}`,
    formula === 'wilks2020' ? 600 : 500,
    input,
    rules[`scoring.${formula}.coefficients`],
    rules[`scoring.${formula}.bodyweightClampKg`],
  );
}

/** Wilks, Wilks2020 and DOTS: numerator / polynomial(clamped BW) × lifted kg. */
function polynomialScore(
  rule: 'scoring.wilks' | 'scoring.wilks2020' | 'scoring.dots',
  numerator: number,
  input: ScoreInput,
  coefficients: Param<Readonly<Record<SexReference, Polynomial>>>,
  clamps: Param<Readonly<Record<SexReference, Range>>>,
): Explained<number> {
  const clamp = clamps.value[input.sex];
  const bodyweight = Math.min(clamp.max, Math.max(clamp.min, input.bodyweightKg));
  const denominator = coefficients.value[input.sex].reduce(
    (sum, c, power) => sum + c * bodyweight ** power,
    0,
  );
  const coefficient = numerator / denominator;
  const value = coefficient * input.liftedKg;
  return explained(value, rule, {
    args: {
      value,
      coefficient,
      clamped: bodyweight !== input.bodyweightKg,
      informal: input.lift !== 'total',
    },
    params: [coefficients, clamps],
  });
}

function ipfPoints(input: ScoreInput, rules: ScoringRules): Explained<number | null> {
  const coefficients = rules['scoring.ipfPoints.coefficients'];
  const minBodyweight = rules['scoring.ipfPoints.minBodyweightKg'];
  const params = [coefficients, minBodyweight];
  if (input.lift === 'squat' || input.lift === 'deadlift') {
    return explained(null, 'scoring.ipfPoints', { args: { unsupportedLift: input.lift }, params });
  }
  const { c1, c2, c3, c4 } = coefficients.value[input.sex][input.division][input.lift];
  let value = 0;
  if (input.liftedKg > 0 && input.bodyweightKg >= minBodyweight.value) {
    const lnBw = Math.log(input.bodyweightKg);
    value = Math.max(0, 500 + (100 * (input.liftedKg - (c1 * lnBw - c2))) / (c3 * lnBw - c4));
  }
  return explained(value, 'scoring.ipfPoints', { args: { value }, params });
}

/**
 * IPF GL (IPF 2020, "The IPF GL Coefficients for Relative Scoring"): coefficient = 100 / (A −
 * B·e^(−C·BW)), applied for BW ≥ 40 kg (men) and ≥ 35 kg (women), the registry's by-sex minimum.
 * The document rounds the coefficient to 6 decimals, multiplies it by the result and rounds the
 * points to 6 decimals; POWR follows it, so its example 92.04 kg / 1035 kg (men, equipped) gives
 * 0.109039 × 1035 = 112.855365 (112.86 at 2 decimals, where the unrounded coefficient gives 112.85).
 */
function ipfGl(input: ScoreInput, rules: ScoringRules): Explained<number | null> {
  const coefficients = rules['scoring.ipfGl.coefficients'];
  const minBodyweight = rules['scoring.ipfGl.minBodyweightKg'];
  const params = [coefficients, minBodyweight];
  if (input.lift === 'squat' || input.lift === 'deadlift') {
    return explained(null, 'scoring.ipfGl', { args: { unsupportedLift: input.lift }, params });
  }
  const { a, b, c } = coefficients.value[input.sex][input.division][input.lift];
  let value = 0;
  if (input.bodyweightKg >= minBodyweight.value[input.sex]) {
    const coefficient = roundTo6(Math.max(0, 100 / (a - b * Math.exp(-c * input.bodyweightKg))));
    value = roundTo6(coefficient * input.liftedKg);
  }
  return explained(value, 'scoring.ipfGl', { args: { value }, params });
}

/** Rounds half up to 6 decimals, as the IPF GL procedure does (non-negative inputs). */
function roundTo6(value: number): number {
  return Math.round(value * 1e6) / 1e6;
}
