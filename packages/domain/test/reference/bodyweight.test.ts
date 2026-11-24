/**
 * Bodyweight trend reference suite (PRD BOD-02; EB §Nutrition › Trend smoothing): EMA α 0.1,
 * gaps via α_eff = 1 − (1 − α)^Δdays, initialisation from the first 3–7 weigh-ins, winsorising
 * beyond 2.5% of the trend, and the 14–28-day regression rate.
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { addDays, type LocalDate } from '../../src';
import { bodyweightRate, bodyweightTrend, type WeighIn } from '../../src/bodyweight';
import { rules } from '../fixtures/rules';

const RULES = rules();
const START = '2026-01-01' as LocalDate;
const weighIn = (day: number, kg: number): WeighIn => ({
  localDate: addDays(START, day),
  mass: { value: kg, unit: 'kg' },
});

describe('initialisation', () => {
  it('shows no trend before 3 weigh-ins, then the running mean up to 7', () => {
    const points = bodyweightTrend(
      [80, 81, 79, 82, 78, 80, 80].map((kg, day) => weighIn(day, kg)),
      RULES,
    ).value;
    expect(points.map((p) => p.trendKg)).toEqual([null, null, 80, 80.5, 80, 80, 80]);
  });

  it('averages several readings on one day and converts lb', () => {
    const points = bodyweightTrend(
      [
        weighIn(0, 80),
        weighIn(0, 81),
        { localDate: addDays(START, 1), mass: { value: 176.37, unit: 'lb' } },
      ],
      RULES,
    ).value;
    expect(points).toHaveLength(2);
    expect(points[0]?.rawKg).toBe(80.5);
    expect(points[1]?.rawKg).toBeCloseTo(80, 2);
  });
});

describe('EMA with gaps and outliers', () => {
  const first7 = Array.from({ length: 7 }, (_, day) => weighIn(day, 80));

  it('moves 10% of the way per day', () => {
    const points = bodyweightTrend([...first7, weighIn(7, 81)], RULES).value;
    expect(points.at(-1)?.trendKg).toBeCloseTo(80.1, 12);
  });

  it('applies α_eff = 1 − 0.9^Δdays across missed days', () => {
    const points = bodyweightTrend([...first7, weighIn(9, 81)], RULES).value;
    // Three days since the last weigh-in: α_eff = 1 − 0.9³ = 0.271.
    expect(points.at(-1)?.trendKg).toBeCloseTo(80.271, 12);
  });

  it('winsorises a reading more than 2.5% from the trend', () => {
    const points = bodyweightTrend([...first7, weighIn(7, 86)], RULES).value;
    expect(points.at(-1)).toMatchObject({ rawKg: 86, usedKg: 82, winsorized: true });
    expect(points.at(-1)?.trendKg).toBeCloseTo(80.2, 12);
  });

  it('is bounded by the range of its inputs', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            gap: fc.integer({ min: 1, max: 10 }),
            kg: fc.double({ min: 40, max: 160, noNaN: true }),
          }),
          {
            minLength: 1,
            maxLength: 60,
          },
        ),
        (entries) => {
          let day = 0;
          const weighIns = entries.map(({ gap, kg }) => weighIn((day += gap), kg));
          const kgs = entries.map((e) => e.kg);
          for (const point of bodyweightTrend(weighIns, RULES).value) {
            if (point.trendKg === null) continue;
            expect(point.trendKg).toBeGreaterThanOrEqual(Math.min(...kgs) - 1e-9);
            expect(point.trendKg).toBeLessThanOrEqual(Math.max(...kgs) + 1e-9);
          }
        },
      ),
    );
  });
});

describe('weekly rate', () => {
  it('is the regression slope over the last 28 days, in kg and % per week', () => {
    // Losing 0.1 kg a day for 40 days from 90 kg.
    const weighIns = Array.from({ length: 40 }, (_, day) => weighIn(day, 90 - 0.1 * day));
    const points = bodyweightTrend(weighIns, RULES).value;
    const rate = bodyweightRate(points, RULES);
    expect(rate.value?.kgPerWeek).toBeCloseTo(-0.7, 9);
    expect(rate.value?.readings).toBe(28);
    expect(rate.value?.spanDays).toBe(27);
    expect(rate.value?.pctPerWeek).toBeCloseTo((-0.7 / points.at(-1)!.trendKg!) * 100, 9);
  });

  it('needs readings spanning at least 14 days', () => {
    const points = bodyweightTrend([weighIn(0, 80), weighIn(10, 79)], RULES).value;
    const rate = bodyweightRate(points, RULES);
    expect(rate.value).toBeNull();
    expect(rate.why.rule).toBe('bodyweight.rate.insufficientData');
    expect(bodyweightRate([], RULES).value).toBeNull();
  });
});
