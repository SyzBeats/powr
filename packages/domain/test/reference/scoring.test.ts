/**
 * Scoring reference vectors (EB §Scoring; PRD ANL-07). The OpenPowerlifting unit-test values are
 * reference vectors only; the formulas are implemented from the published definitions. The EB
 * gives each vector to a stated precision, and the scores must match it exactly at that precision.
 */
import { describe, expect, it } from 'vitest';

import { score, type ScoreInput } from '../../src/scoring';
import { rules } from '../fixtures/rules';

const RULES = rules();

const input = (
  sex: ScoreInput['sex'],
  bodyweightKg: number,
  liftedKg: number,
  division: ScoreInput['division'] = 'classic',
  lift: ScoreInput['lift'] = 'total',
): ScoreInput => ({ sex, bodyweightKg, liftedKg, division, lift });

/** Rounds like the published vector: `decimals` places. */
const at = (value: number | null, decimals: number) =>
  Number((value ?? Number.NaN).toFixed(decimals));

describe('official and OPL test vectors', () => {
  it('Wilks: M 100 kg / 1000 kg → 608.58907; F 60 / 500 → 557.4434', () => {
    expect(at(score('wilks', input('male', 100, 1000), RULES).value, 5)).toBe(608.58907);
    expect(at(score('wilks', input('female', 60, 500), RULES).value, 4)).toBe(557.4434);
  });

  it.each([
    ['male', 40, 1.3895],
    ['male', 60, 0.9968],
    ['male', 80, 0.8191],
    ['male', 100, 0.7294],
    ['male', 120, 0.6817],
    ['male', 140, 0.6546],
    ['male', 200, 0.6123],
    ['female', 40, 1.8486],
    ['female', 60, 1.319],
    ['female', 80, 1.1318],
    ['female', 100, 1.0525],
    ['female', 150, 0.9635],
  ] as const)('Wilks2020 coefficient %s %i kg → %f', (sex, bodyweight, coefficient) => {
    expect(at(score('wilks2020', input(sex, bodyweight, 1), RULES).value, 4)).toBe(coefficient);
  });

  it('IPF Points: M classic 93 / 777.5 → 741.32; F classic 73 / 337.5 → 546.67', () => {
    expect(at(score('ipfPoints', input('male', 93, 777.5), RULES).value, 2)).toBe(741.32);
    expect(at(score('ipfPoints', input('female', 73, 337.5), RULES).value, 2)).toBe(546.67);
  });

  it('IPF GL: M equipped 92.04 / 1035 → 112.85; F classic bench 70.50 / 122.5 → 96.78', () => {
    expect(at(score('ipfGl', input('male', 92.04, 1035, 'equipped'), RULES).value, 2)).toBe(112.85);
    expect(
      at(score('ipfGl', input('female', 70.5, 122.5, 'classic', 'bench'), RULES).value, 2),
    ).toBe(96.78);
  });
});

describe('EB cross-check table (classic 3-lift)', () => {
  it.each([
    ['male', 83, 700, 467.25, 561.15, 472.56, 96.9, 36.25],
    ['male', 100, 800, 486.87, 583.49, 492.41, 101.06, 36.57],
    ['female', 63, 400, 429.58, 511.45, 430.21, 87.51, 24.92],
    ['female', 76, 450, 424.29, 520.63, 435.25, 88.72, 24.72],
  ] as const)('%s %i kg, total %i', (sex, bw, total, wilks, wilks2020, dots, gl, allometric) => {
    const lifter = input(sex, bw, total);
    expect(at(score('wilks', lifter, RULES).value, 2)).toBe(wilks);
    expect(at(score('wilks2020', lifter, RULES).value, 2)).toBe(wilks2020);
    expect(at(score('dots', lifter, RULES).value, 2)).toBe(dots);
    expect(at(score('ipfGl', lifter, RULES).value, 2)).toBe(gl);
    expect(at(score('allometric', lifter, RULES).value, 2)).toBe(allometric);
  });
});

describe('IPF document values, clamps and floors', () => {
  it('uses the IPF value 67.4926 for women equipped bench C4 (not OPL 67.492)', () => {
    const ipf = RULES['scoring.ipfPoints.coefficients'].value.female.equipped.bench;
    expect(ipf.c4).toBe(67.4926);
    const withOplValue = rules({
      'scoring.ipfPoints.coefficients': {
        ...RULES['scoring.ipfPoints.coefficients'].value,
        female: {
          ...RULES['scoring.ipfPoints.coefficients'].value.female,
          equipped: {
            ...RULES['scoring.ipfPoints.coefficients'].value.female.equipped,
            bench: { ...ipf, c4: 67.492 },
          },
        },
      },
    });
    const lifter = input('female', 72, 160, 'equipped', 'bench');
    expect(score('ipfPoints', lifter, RULES).value).not.toBe(
      score('ipfPoints', lifter, withOplValue).value,
    );
  });

  it('clamps bodyweight for Wilks, Wilks2020 and DOTS and says so', () => {
    const light = score('wilks', input('male', 30, 300), RULES);
    expect(light.value).toBe(score('wilks', input('male', 40, 300), RULES).value);
    expect(light.why.args['clamped']).toBe(true);
    expect(score('dots', input('female', 200, 300), RULES).value).toBe(
      score('dots', input('female', 150, 300), RULES).value,
    );
    expect(score('wilks2020', input('female', 160, 300), RULES).value).toBe(
      score('wilks2020', input('female', 150.95, 300), RULES).value,
    );
  });

  it('IPF and GL score 0 below their bodyweight minimum and for a zero total, never below 0', () => {
    expect(score('ipfPoints', input('male', 39.9, 300), RULES).value).toBe(0);
    expect(score('ipfPoints', input('male', 93, 0), RULES).value).toBe(0);
    expect(score('ipfPoints', input('male', 93, 50), RULES).value).toBe(0);
    expect(score('ipfGl', input('male', 34.9, 300), RULES).value).toBe(0);
  });

  it('labels single-lift Wilks/DOTS informal and has no IPF/GL squat or deadlift', () => {
    expect(
      score('dots', input('male', 90, 250, 'classic', 'squat'), RULES).why.args['informal'],
    ).toBe(true);
    expect(score('ipfGl', input('male', 90, 250, 'classic', 'deadlift'), RULES).value).toBeNull();
    expect(score('ipfPoints', input('male', 90, 250, 'classic', 'squat'), RULES).value).toBeNull();
  });
});
