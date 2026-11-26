import { describe, expect, it } from 'vitest';

/**
 * Golden tests (technical concept §8.6.5 check 4): the engine reference values, run against the
 * compiled registry rather than the domain's own test fixture. A transcription error in
 * data/*.yaml, or a registry change that moves an EB reference value, fails here.
 */
import type { MuscleCredit, MuscleId, SourceId } from '@powr/domain';
import { bodyweightRate, bodyweightTrend } from '@powr/domain/bodyweight';
import { loadForTarget } from '@powr/domain/e1rm';
import type { Implement } from '@powr/domain/loading';
import { suggestApre, suggestDoubleProgression } from '@powr/domain/progression';
import { restSeconds } from '@powr/domain/rest';
import { score, type ScoreInput } from '@powr/domain/scoring';
import { muscleVolume, setCredit } from '@powr/domain/volume';
import { generateWarmup } from '@powr/domain/warmup';

import type { ResolveContext } from '../src';
import { resolveRules } from '../src/resolve';
import { buildRules } from './build';

const { compiled } = buildRules();
const resolve = (context: ResolveContext = {}) => {
  if (!compiled) throw new Error('the shipped registry does not compile');
  return resolveRules(compiled, context).rules;
};
const RULES = resolve();
const kg = (value: number) => ({ value, unit: 'kg' as const });

const barbell = (micro: boolean): Implement => ({
  kind: 'barbell',
  bar: { weight: 20, unit: 'kg' },
  plates: {
    unit: 'kg',
    plates: [
      { weight: 20, pairs: 4 },
      { weight: 10, pairs: 1 },
      { weight: 5, pairs: 1 },
      { weight: 2.5, pairs: 1 },
      { weight: 1.25, pairs: 1 },
      ...(micro
        ? [
            { weight: 0.5, pairs: 1 },
            { weight: 0.25, pairs: 2 },
          ]
        : []),
    ],
  },
});

describe('golden: load (EB §Load, PRD PRG-05)', () => {
  const bench = {
    type: 'barbell' as const,
    curveClass: 'equation' as const,
    bodyweightLoaded: false,
  };

  it('e1RM 150 kg, 5 @ RPE 8 → 120.9 kg → 120 kg, or 121 kg with microplates', () => {
    const input = { e1rmKg: 150, reps: 5, rir: 2, exercise: bench };
    const plain = loadForTarget(input, { implement: barbell(false) }, RULES).value;
    expect(plain?.totalKg).toBeCloseTo(120.9, 1);
    expect(plain?.load).toEqual(kg(120));
    expect(loadForTarget(input, { implement: barbell(true) }, RULES).value?.load).toEqual(kg(121));
  });

  it('the RTS option gives 121.7 kg (81.1%)', () => {
    const rts = resolveRules(compiled!, {}, [{ paramId: 'load.e1rm.equation', value: 'rts' }]);
    expect(rts.issues).toEqual([]);
    const target = loadForTarget(
      { e1rmKg: 150, reps: 5, rir: 2, exercise: bench },
      {},
      rts.rules,
    ).value;
    expect(target?.totalKg).toBeCloseTo(121.65, 2);
  });
});

const lifter = (sex: ScoreInput['sex'], bodyweightKg: number, liftedKg: number): ScoreInput => ({
  sex,
  bodyweightKg,
  liftedKg,
  division: 'classic',
  lift: 'total',
});
const at = (value: number | null, decimals: number) =>
  Number((value ?? Number.NaN).toFixed(decimals));

const credit = (muscle: string, value: MuscleCredit['credit']): MuscleCredit => ({
  muscle: muscle as MuscleId,
  credit: value,
  evidence: 'C',
  source: 'src.powr-eb-mapping' as SourceId,
});
const working = (exerciseId: string) => ({
  exerciseId: exerciseId as never,
  type: 'working' as const,
  reps: 10,
  effort: { rir: 2, source: 'entered' as const },
});
const technique = (kind: 'drop' | 'myoReps', units: number) =>
  setCredit({ ...working('ex.curl'), technique: { kind, units } }, RULES).value;
const day = (n: number) => `2026-01-${String(n + 1).padStart(2, '0')}` as never;

describe('golden: scoring (EB §Scoring)', () => {
  it('reproduces the official and cross-check vectors from the registry coefficients', () => {
    expect(at(score('wilks', lifter('male', 100, 1000), RULES).value, 5)).toBe(608.58907);
    expect(at(score('wilks', lifter('female', 60, 500), RULES).value, 4)).toBe(557.4434);
    expect(at(score('wilks2020', lifter('male', 100, 1), RULES).value, 4)).toBe(0.7294);
    expect(at(score('wilks2020', lifter('female', 60, 1), RULES).value, 4)).toBe(1.319);
    expect(at(score('ipfPoints', lifter('male', 93, 777.5), RULES).value, 2)).toBe(741.32);
    expect(at(score('ipfPoints', lifter('female', 73, 337.5), RULES).value, 2)).toBe(546.67);
    // The IPF GL document's examples with its 6-decimal rounding (rules 1.8.0, T-01): 112.855365
    // (112.86; the unrounded coefficient gave the EB's 112.85) and 96.783453.
    const equipped = { ...lifter('male', 92.04, 1035), division: 'equipped' as const };
    expect(score('ipfGl', equipped, RULES).value).toBe(112.855365);
    expect(at(score('ipfGl', equipped, RULES).value, 2)).toBe(112.86);
    const bench = { ...lifter('female', 70.5, 122.5), lift: 'bench' as const };
    expect(score('ipfGl', bench, RULES).value).toBe(96.783453);
    expect(RULES['scoring.ipfGl.minBodyweightKg'].value).toEqual({ male: 40, female: 35 });
    expect(score('ipfGl', lifter('male', 38, 300), RULES).value).toBe(0);
    expect(score('ipfGl', lifter('female', 38, 300), RULES).value).toBeGreaterThan(0);
    const m83 = lifter('male', 83, 700);
    expect(at(score('dots', m83, RULES).value, 2)).toBe(472.56);
    expect(at(score('ipfGl', m83, RULES).value, 2)).toBe(96.9);
    expect(at(score('allometric', lifter('female', 76, 450), RULES).value, 2)).toBe(24.72);
    expect(RULES['scoring.ipfPoints.coefficients'].value.female.equipped.bench.c4).toBe(67.4926);
  });
});

describe('golden: session (EB §Session, PRD TMR-02, WKT-06)', () => {
  it('rest defaults with context variants', () => {
    const squat = resolve({ exercise: { competitionLift: 'squat' } });
    expect(restSeconds({ restClass: 'strength' }, squat).value).toBe(240);
    expect(restSeconds({ restClass: 'strength' }, RULES).value).toBe(180);
    expect(restSeconds({ restClass: 'hypertrophyCompound' }, RULES).value).toBe(150);
    expect(
      restSeconds({ restClass: 'hypertrophyIsolation' }, resolve({ level: 'novice' })).value,
    ).toBe(60);
    expect(restSeconds({ restClass: 'hypertrophyIsolation', timeSaver: true }, RULES).value).toBe(
      60,
    );
  });

  it('heavy warm-up ramp: bar, 40/60/75/85%', () => {
    const ramp = generateWarmup(
      {
        workingLoad: kg(100),
        workingReps: 5,
        e1rmKg: 120,
        mechanics: 'compound',
        firstForPattern: true,
      },
      { implement: barbell(false) },
      RULES,
    ).value.map((set) => [set.load.value, set.reps]);
    expect(ramp).toEqual([
      [20, 8],
      [40, 5],
      [60, 3],
      [75, 2],
      [85, 1],
    ]);
  });
});

describe('golden: volume (EB §Volume, §Session › Techniques)', () => {
  const mapping: Record<string, readonly MuscleCredit[]> = {
    'ex.curl': [credit('mu.biceps', 1)],
    'ex.row': [credit('mu.lats', 1), credit('mu.biceps', 0.5)],
  };

  it('5 curls + 5 rows = 7.5 fractional / 5 direct biceps sets', () => {
    const sets = [...Array(5).fill(working('ex.curl')), ...Array(5).fill(working('ex.row'))];
    const volume = muscleVolume(sets, (id) => mapping[id], RULES).value;
    expect(volume.get('mu.biceps' as MuscleId)).toEqual({ fractional: 7.5, direct: 5 });
  });

  it('technique credits: drop +0.5 per drop (cap 2.0), myo-reps +0.33 (cap 2.5)', () => {
    expect(technique('drop', 1)).toBe(1.5);
    expect(technique('drop', 4)).toBe(2);
    expect(technique('myoReps', 10)).toBe(2.5);
  });
});

describe('golden: progression and bodyweight', () => {
  it('PRD PRG-04: 30 kg 12/12/12 @ RIR 2–3 → 32.5 kg × 8', () => {
    const set = (rir: number) => ({
      type: 'working' as const,
      load: kg(30),
      reps: 12,
      effort: { rir, source: 'entered' as const },
    });
    const result = suggestDoubleProgression(
      { lastSets: [set(2), set(3), set(2)], repRange: [8, 12], targetRir: 2 },
      { implement: { kind: 'steps', unit: 'kg', start: 0, step: 2.5 } },
      RULES,
    );
    expect(result.value).toMatchObject({ action: 'increase', load: kg(32.5), reps: 8 });
  });

  it('APRE-6: 13+ reps on the AMRAP add +5 to 7.5 kg (Mann 2011/2017, +10 to 15 lb; T-01 V-1)', () => {
    const steps = { implement: { kind: 'steps', unit: 'kg', start: 0, step: 2.5 } } as const;
    expect(RULES['progression.apre.sixRm'].value.adjustments.at(-1)).toEqual({
      minReps: 13,
      maxReps: null,
      adjustKg: 6.25,
      rangeKg: { min: 5, max: 7.5 },
    });
    // 100 kg + 6.25 kg = 106.25 kg, on 2.5 kg steps with ties down: 105 kg (was 107.5 kg).
    expect(suggestApre({ sixRm: kg(100), amrapReps: 14 }, steps, RULES).value.load).toEqual(
      kg(105),
    );
  });

  it('bodyweight EMA: α 0.1 per day, α_eff over gaps', () => {
    const weighIns = [
      ...Array.from({ length: 7 }, (_, n) => ({ localDate: day(n), mass: kg(80) })),
      { localDate: day(9), mass: kg(81) },
    ];
    expect(bodyweightTrend(weighIns, RULES).value.at(-1)?.trendKg).toBeCloseTo(80.271, 12);
  });

  it('bodyweight rate: "not enough data yet" until the readings span 21 days (T-01)', () => {
    const daily = (days: number) =>
      bodyweightTrend(
        Array.from({ length: days + 1 }, (_, n) => ({
          localDate: day(n),
          mass: kg(80 - 0.02 * n),
        })),
        RULES,
      ).value;
    expect(bodyweightRate(daily(20), RULES).value).toBeNull();
    expect(bodyweightRate(daily(21), RULES).value?.spanDays).toBe(21);
  });
});
