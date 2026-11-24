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
  type TrendObservation,
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
});

const label = (e1rms: readonly number[], level: 'novice' | 'intermediate' = 'intermediate') =>
  labelChange(runTrend(series(e1rms, 7, 0.04), level, RULES).value, level, RULES).value;

// Twelve weekly heavy-set sessions growing by a constant factor per week.
const weekly = (factor: number) => Array.from({ length: 12 }, (_, i) => 150 * factor ** i);

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
    const likely = label(weekly(1.015));
    expect(likely).toMatchObject({ label: 'likely', direction: 'up' });
    expect(likely.deltaPct).toBeGreaterThan(3.3);
    expect(likely.deltaPct).toBeLessThan(2.8 * 3.3);
    expect(label(weekly(1.03))).toMatchObject({ label: 'veryLikely', direction: 'up' });
    expect(label(weekly(0.97))).toMatchObject({ label: 'veryLikely', direction: 'down' });
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
