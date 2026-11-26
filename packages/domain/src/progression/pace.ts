import { explained, quantity, type Explained } from '../explain';
import type { LocalDate } from '../ids';
import type { RuleSlice, TraineeLevel } from '../rules';
import { daysBetween } from '../time';
import type { BodyRegion } from './types';

/**
 * PRG-07 (TD-44): "when planned increases exceed the user's observed e1RM trend, the engine
 * switches to rep/RPE-based progression". Linear progression adds a fixed increment per session
 * (novices) or a percentage per week (intermediates); when the logged e1RM stops keeping up, the
 * lifter is grinding closer to failure for the same load gain, and loads should come from the
 * e1RM (RPE) or reps should rise first.
 *
 * The check [INF]: over the last `progression.pace.window.weeks` weeks (at least `minExposures`
 * exposures with an e1RM spanning half the window), fit the weighted log-linear slope of the
 * session e1RMs (set weights, PRG-01). Planned increases outrun the trend when the planned weekly
 * increase is above the slope's one-sided 95% upper bound AND the gap, accumulated over the
 * window, exceeds one typical error of the level (the "likely real" threshold of PRG-02, EB
 * §Load › Real change). Both conditions keep noise from switching the model.
 *
 * Rules 1.8.0 (T-01, product-owner decision of 2026-11-25): the upper bound uses the Student t
 * quantile for the fit's n − 2 degrees of freedom, not the normal 1.645, and the window needs at
 * least 6 exposures. With the normal quantile and 4 exposures (2 degrees of freedom, where t is
 * 2.92) a lifter who keeps up fell below the bound in about 12% of windows instead of 5%.
 */

export type PaceRules = RuleSlice<
  | 'progression.pace.window'
  | 'progression.increment.noviceLowerKg'
  | 'progression.increment.noviceUpperKg'
  | 'progression.increment.intermediatePctPerWeek'
  | 'load.trend.typicalErrorCv'
>;

/** One exposure as the pace check reads it (`ExerciseState.recent`). */
export interface PaceSample {
  readonly localDate: LocalDate;
  /** Session e1RM (all sets) and its weight; null when the exposure gave none. */
  readonly e1rmKg: number | null;
  readonly weight: number | null;
}

export interface PaceInput {
  readonly samples: readonly PaceSample[];
  readonly today: LocalDate;
  readonly level: TraineeLevel;
  readonly region: BodyRegion;
  /** The current working load in kg (the novice increment is relative to it). */
  readonly loadKg: number;
}

export interface PaceCheck {
  readonly outrun: boolean;
  /** The linear model's planned increase, % per week; null for advanced lifters (no increments). */
  readonly plannedPctPerWeek: number | null;
  /** Observed e1RM slope and its one-sided 95% upper bound, % per week; null without data. */
  readonly observedPctPerWeek: number | null;
  readonly upperPctPerWeek: number | null;
  readonly exposures: number;
  readonly weeks: number;
}

/** A log-scale slope per day as % per week. */
function toPctPerWeek(perDay: number): number {
  return (Math.exp(perDay * 7) - 1) * 100;
}

export function progressionPace(input: PaceInput, rules: PaceRules): Explained<PaceCheck> {
  const window = rules['progression.pace.window'];
  const te = rules['load.trend.typicalErrorCv'];
  const params = [window, te];
  const weeks = window.value.weeks;
  const since = weeks * 7;
  const samples = input.samples.filter(
    (sample): sample is PaceSample & { readonly e1rmKg: number } =>
      sample.e1rmKg !== null &&
      sample.e1rmKg > 0 &&
      daysBetween(sample.localDate, input.today) <= since &&
      daysBetween(sample.localDate, input.today) >= 0,
  );
  const first = samples[0];
  const last = samples.at(-1);
  const spanDays = first && last ? daysBetween(first.localDate, last.localDate) : 0;
  const perWeek = spanDays > 0 ? ((samples.length - 1) * 7) / spanDays : 0;
  const planned = plannedPctPerWeek(input, perWeek, rules);
  const insufficient =
    samples.length < window.value.minExposures || spanDays * 2 < since || planned === null;
  if (insufficient || !first) {
    const value: PaceCheck = {
      outrun: false,
      plannedPctPerWeek: planned,
      observedPctPerWeek: null,
      upperPctPerWeek: null,
      exposures: samples.length,
      weeks,
    };
    return explained(value, 'progression.pace.ok', {
      args: { insufficient: true, exposures: samples.length, weeks, planned: planned ?? null },
      params,
    });
  }

  const fit = weightedSlope(
    samples.map((sample) => ({
      x: daysBetween(first.localDate, sample.localDate),
      y: Math.log(sample.e1rmKg),
      w: sample.weight !== null && sample.weight > 0 ? sample.weight : 1,
    })),
  );
  const observed = toPctPerWeek(fit.slope);
  // Without residual degrees of freedom the slope's uncertainty is unknown: never switch.
  const margin = fit.dof >= 1 ? studentTQuantile(0.95, fit.dof) * fit.se : Number.POSITIVE_INFINITY;
  const upper = toPctPerWeek(fit.slope + margin);
  const typicalErrorPct = te.value[input.level] * 100;
  const outrun = planned > upper && (planned - observed) * weeks > typicalErrorPct;
  const value: PaceCheck = {
    outrun,
    plannedPctPerWeek: planned,
    observedPctPerWeek: observed,
    upperPctPerWeek: upper,
    exposures: samples.length,
    weeks,
  };
  return explained(value, outrun ? 'progression.pace.switch' : 'progression.pace.ok', {
    args: {
      insufficient: false,
      planned,
      observed,
      upper,
      weeks,
      exposures: samples.length,
      typicalErrorPct,
    },
    facts: [quantity('spanDays', spanDays), quantity('exposuresPerWeek', perWeek)],
    params,
  });
}

/** The linear model's planned weekly increase in % (PRG-06/07 increments); null when it has none. */
function plannedPctPerWeek(
  input: PaceInput,
  exposuresPerWeek: number,
  rules: PaceRules,
): number | null {
  if (input.level === 'advanced' || input.loadKg <= 0) return null;
  if (input.level === 'intermediate') {
    return rules['progression.increment.intermediatePctPerWeek'].value;
  }
  const increment =
    input.region === 'lower'
      ? rules['progression.increment.noviceLowerKg'].value
      : rules['progression.increment.noviceUpperKg'].value;
  return (increment / input.loadKg) * 100 * Math.max(1, exposuresPerWeek);
}

/**
 * Weighted least squares of y on x (weights normalised to mean 1): the slope and its standard
 * error from the weighted residual variance, with its n − 2 degrees of freedom.
 */
function weightedSlope(points: readonly { x: number; y: number; w: number }[]): {
  slope: number;
  se: number;
  dof: number;
} {
  const meanWeight = points.reduce((sum, point) => sum + point.w, 0) / points.length;
  const weighted = points.map((point) => ({ ...point, w: point.w / meanWeight }));
  const sw = weighted.reduce((sum, point) => sum + point.w, 0);
  const mx = weighted.reduce((sum, point) => sum + point.w * point.x, 0) / sw;
  const my = weighted.reduce((sum, point) => sum + point.w * point.y, 0) / sw;
  let sxx = 0;
  let sxy = 0;
  for (const point of weighted) {
    sxx += point.w * (point.x - mx) ** 2;
    sxy += point.w * (point.x - mx) * (point.y - my);
  }
  const dof = weighted.length - 2;
  if (sxx === 0) return { slope: 0, se: Number.POSITIVE_INFINITY, dof };
  const slope = sxy / sxx;
  const intercept = my - slope * mx;
  const residual = weighted.reduce(
    (sum, point) => sum + point.w * (point.y - (intercept + slope * point.x)) ** 2,
    0,
  );
  const se = dof > 0 ? Math.sqrt(residual / dof / sxx) : 0;
  return { slope, se, dof };
}

/**
 * The `p` quantile (0.5 < p < 1) of Student's t distribution with `dof` degrees of freedom (a
 * positive integer), by bisection on the exact distribution function: one-sided 95% gives 6.314
 * (1), 2.920 (2), 2.132 (4), 1.812 (10), 1.697 (30), and tends to the normal 1.645.
 */
export function studentTQuantile(p: number, dof: number): number {
  if (!(p > 0.5 && p < 1) || !Number.isInteger(dof) || dof < 1) {
    throw new RangeError(`Need 0.5 < p < 1 and a positive integer dof, got ${p} and ${dof}`);
  }
  let low = 0;
  let high = 1;
  while (studentTCdf(high, dof) < p) high *= 2;
  for (let step = 0; step < 200 && high - low > 1e-12 * high; step++) {
    const mid = (low + high) / 2;
    if (studentTCdf(mid, dof) < p) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

/**
 * P(T ≤ t) for t ≥ 0 and an integer `dof`: (1 + A) / 2, with A = P(|T| < t) in closed form
 * (Abramowitz & Stegun 26.7.3–26.7.4), θ = atan(t / √dof).
 */
function studentTCdf(t: number, dof: number): number {
  const theta = Math.atan(t / Math.sqrt(dof));
  const cos2 = Math.cos(theta) ** 2;
  let a: number;
  if (dof % 2 === 1) {
    // Odd: (2/π)·(θ + sin θ·(cos θ + (2/3)·cos³θ + … + (2·4…(dof−3))/(1·3…(dof−2))·cos^(dof−2)θ)).
    let term = Math.cos(theta);
    let sum = dof > 1 ? term : 0;
    for (let k = 3; k <= dof - 2; k += 2) {
      term *= ((k - 1) / k) * cos2;
      sum += term;
    }
    a = (2 / Math.PI) * (theta + Math.sin(theta) * sum);
  } else {
    // Even: sin θ·(1 + (1/2)·cos²θ + … + (1·3…(dof−3))/(2·4…(dof−2))·cos^(dof−2)θ).
    let term = 1;
    let sum = 1;
    for (let k = 2; k <= dof - 2; k += 2) {
      term *= ((k - 1) / k) * cos2;
      sum += term;
    }
    a = Math.sin(theta) * sum;
  }
  return (1 + a) / 2;
}
