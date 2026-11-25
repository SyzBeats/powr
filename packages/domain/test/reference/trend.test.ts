/**
 * e1RM trend and change labels (PRD PRG-02; EB §Load › Real change: "a real change must beat about
 * 2.8 typical errors"; technical concept §8.7.5).
 */
import { describe, expect, it } from 'vitest';

import { addDays, type LocalDate } from '../../src';
import type { SetE1rm } from '../../src/e1rm';
import {
  isStrengthSet,
  labelChange,
  runTrend,
  trendObservation,
  trendStep,
  type TrendObservation,
  type TrendPoint,
} from '../../src/trend';
import { rules } from '../fixtures/rules';

const RULES = rules();
const START = '2026-01-05' as LocalDate;

const estimate = (overrides: Partial<SetE1rm> = {}): SetE1rm => ({
  e1rmKg: 150,
  loadKg: 120,
  reps: 5,
  rir: 2,
  reff: 7,
  pct: 0.8,
  weight: 1,
  effortKnown: true,
  effortLogSd: 0,
  prEligible: true,
  ...overrides,
});

const series = (e1rms: readonly number[], everyDays = 3, logSd = 0.04): TrendObservation[] =>
  e1rms.map((e1rmKg, i) => ({
    localDate: addDays(START, i * everyDays),
    e1rmKg,
    weight: 1,
    logSd,
  }));

/** A heavy-set observation of 150 kg, `days` after START. */
const heavyAt = (days: number): TrendObservation => ({
  localDate: addDays(START, days),
  e1rmKg: 150,
  weight: 1,
  logSd: 0.04,
});

describe('observation noise', () => {
  it('is 4% for heavy sets and 9% for typical sets, widened for unknown effort and novices', () => {
    const context = { level: 'intermediate' as const, weeksOfData: 20 };
    expect(trendObservation(estimate({ reff: 4, rir: 1 }), START, context, RULES).logSd).toBe(0.04);
    expect(trendObservation(estimate(), START, context, RULES).logSd).toBe(0.09);
    const unknown = trendObservation(
      estimate({ effortKnown: false, effortLogSd: 0.045 }),
      START,
      context,
      RULES,
    );
    expect(unknown.logSd).toBeCloseTo(Math.hypot(0.09, 0.045), 12);
    const novice = trendObservation(estimate(), START, { level: 'novice', weeksOfData: 4 }, RULES);
    expect(novice.logSd).toBeCloseTo(0.135, 12);
  });

  it('the strength trend takes sets with r_eff ≤ 8', () => {
    expect(isStrengthSet(estimate({ reff: 8 }), RULES)).toBe(true);
    expect(isStrengthSet(estimate({ reff: 9 }), RULES)).toBe(false);
  });
});

describe('filter', () => {
  it('starts at the first observation and stays within the observations', () => {
    const points = runTrend(series([150, 152, 149, 151]), 'intermediate', RULES).value;
    expect(points[0]?.e1rmKg).toBeCloseTo(150, 9);
    for (const point of points) {
      expect(point.e1rmKg).toBeGreaterThan(149);
      expect(point.e1rmKg).toBeLessThan(152);
      expect(point.lowKg).toBeLessThan(point.e1rmKg);
      expect(point.highKg).toBeGreaterThan(point.e1rmKg);
    }
  });

  it('smooths noise: a single outlier moves the trend much less than the raw value', () => {
    const steady = Array.from({ length: 12 }, () => 150);
    const points = runTrend(series([...steady, 165], 3, 0.09), 'advanced', RULES).value;
    expect(points.at(-1)!.e1rmKg).toBeLessThan(152);
  });

  it('weights heavy sets more than typical sets', () => {
    const heavy = runTrend(series([150, 150, 150, 160], 3, 0.04), 'intermediate', RULES).value.at(
      -1,
    )!;
    const typical = runTrend(series([150, 150, 150, 160], 3, 0.09), 'intermediate', RULES).value.at(
      -1,
    )!;
    expect(heavy.e1rmKg).toBeGreaterThan(typical.e1rmKg);
  });

  it('is independent of the input order (sorted by date)', () => {
    const observations = series([150, 152, 149, 151, 155]);
    const forward = runTrend(observations, 'intermediate', RULES).value;
    const shuffled = runTrend(observations.toReversed(), 'intermediate', RULES).value;
    expect(shuffled).toEqual(forward);
  });

  it('grows the uncertainty with the days since the last session (P += q·Δdays), none on the same day', () => {
    // The process noise is per week (registry), so the prediction scales with the gap: a 6-week
    // break adds six weeks of variance and the next session moves the trend more.
    const qPerDay = RULES['load.trend.processSdPerWeek'].value.intermediate ** 2 / 7;
    const first = trendStep(null, heavyAt(0), 'intermediate', RULES);
    const r = 0.04 ** 2;
    for (const days of [0, 3, 7, 14, 42]) {
      const predicted = first.logVariance + qPerDay * days;
      expect(trendStep(first, heavyAt(days), 'intermediate', RULES).logVariance).toBeCloseTo(
        (predicted * r) / (predicted + r),
        15,
      );
    }
  });
});

const label = (e1rms: readonly number[], level: 'novice' | 'intermediate' = 'intermediate') =>
  labelChange(runTrend(series(e1rms, 7, 0.04), level, RULES).value, level, RULES).value;

// Weekly heavy-set sessions (twelve by default) growing by a constant factor per week.
const weekly = (factor: number, length = 12) => Array.from({ length }, (_, i) => 150 * factor ** i);

/** A hand-made trend point: weekly from START, log mean and variance given. */
const point = (week: number, logMean: number, logVariance: number): TrendPoint => ({
  localDate: addDays(START, week * 7),
  e1rmKg: 100 * Math.exp(logMean),
  lowKg: 100 * Math.exp(logMean - 1.96 * Math.sqrt(logVariance)),
  highKg: 100 * Math.exp(logMean + 1.96 * Math.sqrt(logVariance)),
  logMean: Math.log(100) + logMean,
  logVariance,
});

/** Weekly hand-made points with a 5% step after week 5, all with the same variance. */
const steps = (variance: number) => [
  ...[0, 1, 2, 3, 4, 5].map((week) => point(week, 0, variance)),
  ...[6, 7, 8].map((week) => point(week, 0.05, variance)),
];

describe('change labels', () => {
  it('needs a reference point', () => {
    expect(label([150, 151]).label).toBe('insufficientData');
  });

  it('calls flat data no change', () => {
    expect(label([150, 151, 149, 150, 151, 150, 149, 150])).toMatchObject({
      label: 'none',
      direction: null,
    });
  });

  it('does not label slow progress that stays within 1 TE (3.3% for trained lifters)', () => {
    expect(label(weekly(1.003)).label).toBe('none');
  });

  it('calls a sustained rise above 1 TE "likely real" and above 2.8 TE "very likely real"', () => {
    // Rules 1.6.0, likelyZ 1.5: "likely" needs three sessions in a row beyond 1 TE and 1.5 SD of
    // the change, "very likely" 1.96 SD (or 2.8 TE). Weekly heavy sets settle at SD(Δ) ≈ 2.7%, so
    // the "likely" band is about 4–5.3%. +0.6% a week (a trained lifter's good block) settles at
    // an 8-week change of about 4.5–4.9%, inside it: "likely" from the 17th weekly session.
    const likely = label(weekly(1.006, 17));
    expect(likely).toMatchObject({ label: 'likely', direction: 'up' });
    expect(likely.deltaPct).toBeGreaterThan(3.3);
    expect(likely.deltaPct).toBeLessThan(2.8 * 3.3);
    expect(label(weekly(1.006, 16)).label).toBe('none');
    // +1% a week (likely from the 11th session with likelyZ 1) is beyond 1.96 SD by the time it
    // has held beyond 1.5 SD: it goes from no change straight to "very likely" at the 12th.
    expect(label(weekly(1.01, 11)).label).toBe('none');
    expect(label(weekly(1.01, 12)).label).toBe('veryLikely');
    expect(label(weekly(1.03))).toMatchObject({ label: 'veryLikely', direction: 'up' });
    expect(label(weekly(0.97))).toMatchObject({ label: 'veryLikely', direction: 'down' });
  });

  it('measures the change over the level window: 8 weeks for trained lifters, 4 for novices', () => {
    const observations = series(weekly(1.01, 12), 7, 0.04);
    const at = (level: 'novice' | 'intermediate' | 'advanced') =>
      labelChange(runTrend(observations, level, RULES).value, level, RULES).value.referenceDate;
    expect(at('intermediate')).toBe(addDays(START, 3 * 7));
    expect(at('advanced')).toBe(addDays(START, 3 * 7));
    expect(at('novice')).toBe(addDays(START, 7 * 7));
  });

  it('never compares against one of the first three points; before the window, the oldest after them', () => {
    const flat = (n: number) =>
      runTrend(series(weekly(1, n), 7, 0.04), 'intermediate', RULES).value;
    // Six sessions: the reference would have to be 3 sessions back, i.e. one of the first three.
    expect(labelChange(flat(6), 'intermediate', RULES).value.label).toBe('insufficientData');
    // Seven and eight: no point is 8 weeks back yet, so the fourth point is the reference.
    expect(labelChange(flat(7), 'intermediate', RULES).value.referenceDate).toBe(
      addDays(START, 21),
    );
    expect(labelChange(flat(8), 'intermediate', RULES).value.referenceDate).toBe(
      addDays(START, 21),
    );
  });

  it('claims no change within its own uncertainty, even beyond one typical error', () => {
    // A 5% step (beyond 1 TE = 3.3%) held for three sessions against the fourth point.
    // SD of the change √(2 × 0.002) = 6.3%: within its own uncertainty.
    expect(labelChange(steps(0.002), 'intermediate', RULES).value.label).toBe('none');
    // SD 3.5%: z 1.44, below likelyZ 1.5 (rules 1.6.0, product owner 2026-11-25): no claim.
    expect(labelChange(steps(0.0006), 'intermediate', RULES).value.label).toBe('none');
    // SD 2.8%: beyond 1.5 SD (z 1.77), but not beyond 1.96 SD or 2.8 TE: "likely".
    expect(labelChange(steps(0.0004), 'intermediate', RULES).value).toMatchObject({
      label: 'likely',
      direction: 'up',
    });
    // SD 2%: the 95% interval excludes zero: "very likely".
    expect(labelChange(steps(0.0002), 'intermediate', RULES).value.label).toBe('veryLikely');
  });

  it('uses the novice typical error (5.5%) for novices', () => {
    const result = labelChange(
      runTrend(series([100, 100, 100, 100]), 'novice', RULES).value,
      'novice',
      RULES,
    );
    expect(result.value.typicalError).toBe(0.055);
    expect(result.why.params.map((p) => p.id)).toContain('load.trend.typicalErrorCv');
  });
});
