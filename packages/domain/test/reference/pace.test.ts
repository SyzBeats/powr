/**
 * PRG-07 pace check on noise (TD-44; rules 1.8.0, T-01 evidence verification, product-owner
 * decision of 2026-11-25): the switch from linear increases to RPE loading uses the Student t
 * quantile for the slope's upper bound and needs at least 6 exposures, so a lifter who keeps up
 * with the plan is switched by noise in about the intended 5% of windows, not about 12%.
 *
 * A seeded simulation: the true e1RM rises exactly at the planned rate, and each session e1RM
 * scatters around it with log-normal noise (the trained typical error, 3.3%, and the typical-set
 * noise the trend filter assumes, 9%). `bound` counts windows where the planned increase lies
 * above the slope's one-sided 95% upper bound (the statistical part of the check), `switched`
 * those where the whole check fires (the gap over the window must also exceed one typical error).
 */
import { describe, expect, it } from 'vitest';

import { addDays, type LocalDate } from '../../src';
import { progressionPace, type PaceSample } from '../../src/progression';
import { studentTQuantile } from '../../src/progression/pace';
import { rules } from '../fixtures/rules';
import { mulberry32, normal } from '../fixtures/trend-sim';

const RULES = rules();
const START = '2026-03-02' as LocalDate;
const RUNS = 2000;
/** The intermediate plan: +1% a week (`progression.increment.intermediatePctPerWeek`). */
const PLANNED = RULES['progression.increment.intermediatePctPerWeek'].value;

/** Session days spread evenly over the 4-week window (6 exposures: every 5 days). */
const days = (exposures: number) =>
  Array.from({ length: exposures }, (_, i) => Math.round((i * 25) / (exposures - 1)));

interface Rates {
  readonly bound: number;
  readonly switched: number;
  /** The bound condition with the normal quantile 1.645 instead (the check before rules 1.8.0). */
  readonly normalBound: number;
}

function noiseRates(exposures: number, noiseSd: number, ruleSet = RULES, seed = 1): Rates {
  const random = mulberry32(seed);
  const perDay = Math.log(1 + PLANNED / 100) / 7;
  let bound = 0;
  let switched = 0;
  let normalBound = 0;
  for (let run = 0; run < RUNS; run++) {
    const samples: PaceSample[] = days(exposures).map((day) => ({
      localDate: addDays(START, day),
      e1rmKg: 120 * Math.exp(perDay * day + noiseSd * normal(random)),
      weight: 1,
    }));
    const pace = progressionPace(
      {
        samples,
        today: addDays(START, 25),
        level: 'intermediate',
        region: 'lower',
        loadKg: 100,
      },
      ruleSet,
    ).value;
    if (pace.outrun) switched++;
    // Too few exposures: no fit, never a switch.
    if (pace.observedPctPerWeek === null || pace.upperPctPerWeek === null) continue;
    const observed = Math.log(1 + pace.observedPctPerWeek / 100) / 7;
    const upper = Math.log(1 + pace.upperPctPerWeek / 100) / 7;
    const se = (upper - observed) / studentTQuantile(0.95, exposures - 2);
    if (PLANNED > pace.upperPctPerWeek) bound++;
    if (perDay > observed + 1.6448536269514722 * se) normalBound++;
  }
  return { bound: bound / RUNS, switched: switched / RUNS, normalBound: normalBound / RUNS };
}

describe('Student t quantile', () => {
  it.each([
    [1, 6.313752],
    [2, 2.919986],
    [3, 2.353363],
    [4, 2.131847],
    [5, 2.015048],
    [6, 1.94318],
    [10, 1.812461],
    [30, 1.697261],
    [120, 1.657651],
  ])('one-sided 95%% with %i degrees of freedom: %f', (dof, quantile) => {
    expect(studentTQuantile(0.95, dof)).toBeCloseTo(quantile, 5);
  });

  it('gives other levels and tends to the normal quantile; rejects invalid input', () => {
    expect(studentTQuantile(0.975, 4)).toBeCloseTo(2.776445, 5);
    expect(studentTQuantile(0.975, 9)).toBeCloseTo(2.262157, 5);
    expect(studentTQuantile(0.95, 100_000)).toBeCloseTo(1.644854, 4);
    expect(() => studentTQuantile(0.95, 0)).toThrow(RangeError);
    expect(() => studentTQuantile(0.4, 5)).toThrow(RangeError);
  });
});

describe('PRG-07 false switches on noise (rules 1.8.0: t quantile, at least 6 exposures)', () => {
  // 2,000 seeded windows each: the binomial standard error at 5% is about 0.5 points, so the
  // bounds below are about 3 standard errors around the intended 5%. Measured on 2026-11-25:
  // 6 exposures 5.95% (normal quantile 9.2%), 8 exposures 4.95% (7.75%). The miss rate does not
  // depend on the noise size (the same seed gives the same rate at 3.3% and 9%); the whole
  // switch then fires as often, because with this noise a missed bound means a gap far above
  // one typical error.
  it.each([
    [6, 0.033],
    [6, 0.09],
    [8, 0.033],
    [8, 0.09],
  ])('%i exposures, noise SD %f: the upper bound misses about 5% of windows', (exposures, sd) => {
    const rates = noiseRates(exposures, sd);
    expect(rates.bound).toBeGreaterThan(0.035);
    expect(rates.bound).toBeLessThan(0.065);
    // The typical-error gap keeps the whole switch at or below the bound's rate.
    expect(rates.switched).toBeLessThanOrEqual(rates.bound);
  });

  it('the normal quantile with the former minimum of 4 exposures missed about 12% (12.45%; t: 5.35%)', () => {
    const four = rules({ 'progression.pace.window': { weeks: 4, minExposures: 4 } });
    const rates = noiseRates(4, 0.09, four);
    expect(rates.bound).toBeGreaterThan(0.035);
    expect(rates.bound).toBeLessThan(0.065);
    expect(rates.normalBound).toBeGreaterThan(0.09);
    expect(rates.normalBound).toBeLessThan(0.15);
  });

  it('the registry asks for 6 exposures: windows with 4 or 5 never switch', () => {
    expect(RULES['progression.pace.window'].value).toEqual({ weeks: 4, minExposures: 6 });
    expect(noiseRates(5, 0.09).switched).toBe(0);
  });
});
