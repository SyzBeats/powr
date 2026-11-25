/**
 * `@powr/domain/trend`: the noise-aware e1RM trend (PRG-02, technical concept §8.7.5; EB §Load ›
 * Real change). A local-level Kalman filter on ln(e1RM) per exercise, fed one observation per
 * session (run it twice: strength sets only, and all sets), and change labels that compare the
 * smoothed change with the typical error: "likely real" above 1 TE for consecutive sessions,
 * "very likely real" above 2.8 TE or when its 95% interval excludes zero.
 */
import type { SetE1rm } from '../e1rm';
import { explained, quantity, type Explained } from '../explain';
import type { LocalDate } from '../ids';
import type { RuleSlice, TraineeLevel } from '../rules';
import { daysBetween } from '../time';

/** Variances are floored so the gain never degenerates (§8.7.2). */
const MIN_VARIANCE = 1e-8;
const Z95 = 1.959963984540054;

export type ObservationRules = RuleSlice<
  | 'load.trend.noiseHeavySd'
  | 'load.trend.noiseTypicalSd'
  | 'load.trend.heavySet'
  | 'load.trend.noviceWidening'
>;

export interface TrendObservation {
  readonly localDate: LocalDate;
  readonly e1rmKg: number;
  /** Set weight (0 < w ≤ 1); the observation variance is σ² / w. */
  readonly weight: number;
  /** σ on the log scale. */
  readonly logSd: number;
}

/** Sets that feed the strength trend: r_eff at or below the registry limit (6–8). */
export function isStrengthSet(
  estimate: SetE1rm,
  rules: RuleSlice<'load.trend.strengthMaxReff'>,
): boolean {
  return estimate.reff <= rules['load.trend.strengthMaxReff'].value;
}

/**
 * Turns a session e1RM into a filter observation. σ is 4% for heavy sets (low r_eff, RPE ≥ 9) and
 * 9% otherwise, widened in quadrature by the effort prior of sets without RIR (E-1) and, for
 * novices, during their first weeks of data.
 */
export function trendObservation(
  estimate: SetE1rm,
  localDate: LocalDate,
  context: { readonly level: TraineeLevel; readonly weeksOfData: number },
  rules: ObservationRules,
): TrendObservation {
  const heavy = rules['load.trend.heavySet'].value;
  const isHeavy =
    estimate.effortKnown && estimate.reff <= heavy.maxReff && 10 - estimate.rir >= heavy.minRpe;
  const base = isHeavy
    ? rules['load.trend.noiseHeavySd'].value
    : rules['load.trend.noiseTypicalSd'].value;
  const widening = rules['load.trend.noviceWidening'].value;
  const factor =
    context.level === 'novice' && context.weeksOfData <= widening.weeks ? widening.factor : 1;
  return {
    localDate,
    e1rmKg: estimate.e1rmKg,
    weight: estimate.weight,
    logSd: Math.hypot(base, estimate.effortLogSd) * factor,
  };
}

export interface TrendPoint {
  readonly localDate: LocalDate;
  /** Smoothed e1RM and its 95% band. */
  readonly e1rmKg: number;
  readonly lowKg: number;
  readonly highKg: number;
  readonly logMean: number;
  readonly logVariance: number;
}

/**
 * Runs the filter over observations in date order (same-day observations keep their order).
 * Prediction: P += q·Δdays with q from the level's weekly process SD; update with R = σ² / w.
 */
export function runTrend(
  observations: readonly TrendObservation[],
  level: TraineeLevel,
  rules: RuleSlice<'load.trend.processSdPerWeek'>,
): Explained<readonly TrendPoint[]> {
  const sorted = observations.toSorted((a, b) =>
    a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0,
  );
  const points: TrendPoint[] = [];
  let previous: TrendPoint | null = null;
  for (const observation of sorted) {
    previous = trendStep(previous, observation, level, rules);
    points.push(previous);
  }
  return explained(points, 'trend.series', {
    args: { level, observations: sorted.length },
    params: [rules['load.trend.processSdPerWeek']],
  });
}

/**
 * One step of the filter (the loop body of `runTrend`): the first observation starts the series,
 * later ones predict P += q·Δdays and update with R = σ² / w. The session engine folds one
 * observation per exposure into the stored trend state (M3, `dExerciseState`), so a stored series
 * and `runTrend` over the same observations agree exactly.
 */
export function trendStep(
  previous: TrendPoint | null,
  observation: TrendObservation,
  level: TraineeLevel,
  rules: RuleSlice<'load.trend.processSdPerWeek'>,
): TrendPoint {
  const processSd = rules['load.trend.processSdPerWeek'].value[level];
  const qPerDay = (processSd * processSd) / 7;
  const z = Math.log(observation.e1rmKg);
  const r = (observation.logSd * observation.logSd) / observation.weight;
  let mean: number;
  let variance: number;
  if (previous === null) {
    mean = z;
    variance = Math.max(r, MIN_VARIANCE);
  } else {
    variance =
      previous.logVariance +
      qPerDay * Math.max(0, daysBetween(previous.localDate, observation.localDate));
    const gain = variance / (variance + r);
    mean = previous.logMean + gain * (z - previous.logMean);
    variance = Math.max((1 - gain) * variance, MIN_VARIANCE);
  }
  const half = Z95 * Math.sqrt(variance);
  return {
    localDate: observation.localDate,
    e1rmKg: Math.exp(mean),
    lowKg: Math.exp(mean - half),
    highKg: Math.exp(mean + half),
    logMean: mean,
    logVariance: variance,
  };
}

export type ChangeRules = RuleSlice<
  'load.trend.typicalErrorCv' | 'load.trend.changeThresholds' | 'load.trend.reference'
>;

export interface ChangeLabel {
  readonly label: 'insufficientData' | 'none' | 'likely' | 'veryLikely';
  readonly direction: 'up' | 'down' | null;
  /** Smoothed change on the log scale and in percent. */
  readonly deltaLog: number;
  readonly deltaPct: number;
  readonly referenceDate: LocalDate | null;
  /** The typical error (CV) of the level. */
  readonly typicalError: number;
}

/**
 * Labels the change of the latest trend point (or of the point at `at`, M4a: the label a chart
 * shows at each session) against its reference point.
 */
export function labelChange(
  points: readonly TrendPoint[],
  level: TraineeLevel,
  rules: ChangeRules,
  at: number = points.length - 1,
): Explained<ChangeLabel> {
  const te = rules['load.trend.typicalErrorCv'].value[level];
  const thresholds = rules['load.trend.changeThresholds'].value;
  const params = [
    rules['load.trend.typicalErrorCv'],
    rules['load.trend.changeThresholds'],
    rules['load.trend.reference'],
  ];
  const now = Math.min(at, points.length - 1);
  const current = deltaAt(points, now, rules);
  if (current === null) {
    return explained(
      {
        label: 'insufficientData',
        direction: null,
        deltaLog: 0,
        deltaPct: 0,
        referenceDate: null,
        typicalError: te,
      },
      'trend.change.insufficientData',
      { params },
    );
  }

  const sign = Math.sign(current.delta);
  const size = Math.abs(current.delta);
  // Never a claim within one typical error (the noise, EB §Load › Real change); beyond it, 2.8 TE
  // or a 95% interval of the change that excludes zero makes it "very likely" (M4a: the interval
  // alone no longer labels a change smaller than 1 TE).
  const beyondNoise = size > thresholds.likelyTe * te;
  const veryLikely =
    beyondNoise && (size > thresholds.veryLikelyTe * te || size > Z95 * current.sd);
  let sustained = sign !== 0;
  for (let k = 0; k < thresholds.sustainSessions && sustained; k++) {
    const earlier = deltaAt(points, now - k, rules);
    sustained =
      earlier !== null &&
      Math.sign(earlier.delta) === sign &&
      Math.abs(earlier.delta) > thresholds.likelyTe * te;
  }
  const label = veryLikely ? 'veryLikely' : sustained ? 'likely' : 'none';
  const value: ChangeLabel = {
    label,
    direction: label === 'none' ? null : sign > 0 ? 'up' : 'down',
    deltaLog: current.delta,
    deltaPct: (Math.exp(current.delta) - 1) * 100,
    referenceDate: current.reference.localDate,
    typicalError: te,
  };
  return explained(value, `trend.change.${label}`, {
    args: { deltaPct: value.deltaPct, typicalErrorPct: te * 100, direction: value.direction },
    facts: [
      quantity('referenceDate', current.reference.localDate),
      quantity('referenceE1rmKg', current.reference.e1rmKg),
      quantity('currentE1rmKg', points[now]?.e1rmKg ?? null),
    ],
    params,
  });
}

/**
 * The change of point `index` against its reference: the smoothed value 4 weeks or 3 sessions
 * earlier, whichever is older (registry `load.trend.reference`).
 */
function deltaAt(
  points: readonly TrendPoint[],
  index: number,
  rules: RuleSlice<'load.trend.reference'>,
): { delta: number; sd: number; reference: TrendPoint } | null {
  const point = points[index];
  if (point === undefined) return null;
  const { weeks, sessions } = rules['load.trend.reference'].value;
  let byWeeks = -1;
  for (let j = index - 1; j >= 0; j--) {
    const candidate = points[j];
    if (candidate && daysBetween(candidate.localDate, point.localDate) >= weeks * 7) {
      byWeeks = j;
      break;
    }
  }
  const bySessions = index - sessions;
  const candidates = [byWeeks, bySessions].filter((j) => j >= 0);
  if (candidates.length === 0) return null;
  const reference = points[Math.min(...candidates)];
  if (reference === undefined) return null;
  return {
    delta: point.logMean - reference.logMean,
    sd: Math.sqrt(point.logVariance + reference.logVariance),
    reference,
  };
}

/** One exposure's typical rep count, as the rep-range check reads it. */
export interface RepRangeSample {
  readonly localDate: LocalDate;
  /** Median reps of the exposure's working sets; null without one. */
  readonly medianReps: number | null;
}

export interface RepRangeShift {
  readonly shifted: boolean;
  /** Median reps around the reference date and of the latest exposures. */
  readonly medianBefore: number | null;
  readonly medianNow: number | null;
  readonly shift: number;
}

/**
 * PRG-02, TD-26 (EB §Load › e1RM drift): an e1RM change that coincides with a change of the
 * typical rep range (a hypertrophy block followed by a strength block) is possibly an artefact of
 * the load–rep curve, not a strength change. Compares the median reps of the latest `recentCount`
 * exposures with the up to three exposures on or before the change's reference date; a shift of
 * at least `load.trend.repRangeShift` reps is flagged.
 */
export function repRangeShift(
  samples: readonly RepRangeSample[],
  referenceDate: LocalDate | null,
  rules: RuleSlice<'load.trend.repRangeShift'>,
  recentCount = 2,
): Explained<RepRangeShift> {
  const param = rules['load.trend.repRangeShift'];
  const withReps = samples.filter(
    (sample): sample is RepRangeSample & { readonly medianReps: number } =>
      sample.medianReps !== null,
  );
  const now = withReps.slice(-recentCount).map((sample) => sample.medianReps);
  const before =
    referenceDate === null
      ? []
      : withReps
          .filter((sample) => sample.localDate <= referenceDate)
          .slice(-3)
          .map((sample) => sample.medianReps);
  const medianNow = median(now);
  const medianBefore = median(before);
  const shift =
    medianNow === null || medianBefore === null ? 0 : Math.abs(medianNow - medianBefore);
  const value: RepRangeShift = {
    shifted: medianNow !== null && medianBefore !== null && shift >= param.value,
    medianBefore,
    medianNow,
    shift,
  };
  return explained(value, 'trend.change.repRange', {
    args: { medianBefore, medianNow, shift, threshold: param.value, shifted: value.shifted },
    params: [param],
  });
}

/** The median of a list (the mean of the middle two for an even count); null when empty. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? (sorted[middle] ?? null)
    : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

/** A trend point rebuilt from a stored band (`dSessionE1rm`): the band is ±1.96 SD on the log scale. */
export function pointFromBand(
  localDate: LocalDate,
  band: { readonly e1rmKg: number; readonly lowKg: number; readonly highKg: number },
): TrendPoint {
  const half = (Math.log(band.highKg) - Math.log(band.lowKg)) / 2;
  const sd = half / Z95;
  return {
    localDate,
    e1rmKg: band.e1rmKg,
    lowKg: band.lowKg,
    highKg: band.highKg,
    logMean: Math.log(band.e1rmKg),
    logVariance: Math.max(sd * sd, MIN_VARIANCE),
  };
}
