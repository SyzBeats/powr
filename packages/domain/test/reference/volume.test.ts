/**
 * Volume reference suite (PRD EXL-05, WKT-04; EB §Volume › Count synergist sets as half,
 * §Session › Techniques, §Defaults › Volume).
 */
import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Effort, ExerciseId, LocalDate, MuscleCredit, MuscleId, SourceId } from '../../src';
import {
  checkSessionVolume,
  classifyWeeklyVolume,
  creditTable,
  isHardSet,
  muscleVolume,
  parentMuscle,
  setCredit,
  weeklyMuscleVolume,
  type VolumeSet,
} from '../../src/volume';
import { rules } from '../fixtures/rules';

const RULES = rules();
const id = (value: string) => value as ExerciseId;
const mu = (value: string) => value as MuscleId;
const credit = (muscle: string, value: MuscleCredit['credit']): MuscleCredit => ({
  muscle: mu(muscle),
  credit: value,
  evidence: 'C',
  source: 'src.powr-eb-mapping' as SourceId,
});

const MAPPING: Record<string, readonly MuscleCredit[]> = {
  'ex.curl': [credit('mu.biceps', 1), credit('mu.forearms', 0.25)],
  'ex.row': [credit('mu.lats', 1), credit('mu.biceps', 0.5)],
  'ex.squat': [
    credit('mu.quads.vasti', 1),
    credit('mu.quads.rectus-femoris', 0),
    credit('mu.glutes', 0.5),
  ],
  'ex.leg-extension': [credit('mu.quads.vasti', 1), credit('mu.quads.rectus-femoris', 1)],
};
const creditsOf = (exercise: ExerciseId) => MAPPING[exercise];

const entered = (rir: number): Effort => ({ rir, source: 'entered' });
const sets = (exercise: string, count: number, rir = 2, reps = 10): VolumeSet[] =>
  Array.from({ length: count }, () => ({
    exerciseId: id(exercise),
    type: 'working',
    reps,
    effort: entered(rir),
  }));

const working = (rir: number | null, reps = 10): VolumeSet => ({
  exerciseId: id('ex.curl'),
  type: 'working',
  reps,
  effort: rir === null ? { rir: null, source: 'none' } : entered(rir),
});

const technique = (kind: NonNullable<VolumeSet['technique']>['kind'], units?: number) =>
  setCredit({ ...working(0), technique: units === undefined ? { kind } : { kind, units } }, RULES)
    .value;

const dated = (localDate: string, exercise: string) => ({
  ...sets(exercise, 1)[0]!,
  localDate: localDate as LocalDate,
});

describe('fractional vs direct counting (EB worked example)', () => {
  it('5 curls + 5 rows = 7.5 fractional / 5 direct biceps sets', () => {
    const volume = muscleVolume(
      [...sets('ex.curl', 5), ...sets('ex.row', 5)],
      creditsOf,
      RULES,
    ).value;
    expect(volume.get(mu('mu.biceps'))).toEqual({ fractional: 7.5, direct: 5 });
    expect(volume.get(mu('mu.lats'))).toEqual({ fractional: 5, direct: 5 });
    expect(volume.get(mu('mu.forearms'))).toEqual({ fractional: 1.25, direct: 0 });
  });

  it('rolls sub-regions up to the parent once per set, with the largest credit', () => {
    expect(parentMuscle(mu('mu.quads.vasti'))).toBe('mu.quads');
    expect(parentMuscle(mu('mu.quads'))).toBe('mu.quads');
    expect(creditTable(MAPPING['ex.leg-extension']!).get(mu('mu.quads'))).toBe(1);
    const volume = muscleVolume(
      [...sets('ex.squat', 4), ...sets('ex.leg-extension', 3)],
      creditsOf,
      RULES,
    ).value;
    expect(volume.get(mu('mu.quads'))).toEqual({ fractional: 7, direct: 7 });
    expect(volume.get(mu('mu.quads.vasti'))).toEqual({ fractional: 7, direct: 7 });
    // Squats do not count toward the rectus femoris (credit 0): only leg extensions do.
    expect(volume.get(mu('mu.quads.rectus-femoris'))).toEqual({ fractional: 3, direct: 3 });
    expect(volume.get(mu('mu.glutes'))).toEqual({ fractional: 2, direct: 0 });
  });

  it('reports sets of exercises without a mapping', () => {
    const result = muscleVolume(sets('ex.unknown', 2), creditsOf, RULES);
    expect(result.value.size).toBe(0);
    expect(result.why.args['unmapped']).toBe(2);
  });
});

describe('hard-set rule (EXL-05)', () => {
  it('counts working sets at RIR ≤ 4 or unknown; above 20 reps only at RIR ≤ 2', () => {
    expect(isHardSet(working(4), RULES)).toBe(true);
    expect(isHardSet(working(4.5), RULES)).toBe(false);
    expect(isHardSet(working(null), RULES)).toBe(true);
    expect(isHardSet(working(2, 25), RULES)).toBe(true);
    expect(isHardSet(working(3, 25), RULES)).toBe(false);
    expect(isHardSet({ ...working(1), type: 'warmup' }, RULES)).toBe(false);
    expect(isHardSet({ ...working(1), state: 'skipped' }, RULES)).toBe(false);
  });
});

describe('technique credits and caps (WKT-04)', () => {
  it.each([
    ['drop', 1, 1.5],
    ['drop', 2, 2],
    ['drop', 3, 2],
    ['restPause', 2, 1.66],
    ['restPause', 5, 2],
    ['myoReps', 3, 1.99],
    ['myoReps', 6, 2.5],
    ['cluster', undefined, 1],
    ['lengthenedPartials', undefined, 1],
    ['partialExtension', undefined, 1.25],
  ] as const)('%s with %s units → %f', (kind, units, expected) => {
    expect(technique(kind, units)).toBeCloseTo(expected, 9);
  });

  it('warm-ups count 0', () => {
    expect(
      setCredit({ exerciseId: id('ex.curl'), type: 'warmup', reps: 10, effort: entered(5) }, RULES)
        .value,
    ).toBe(0);
  });

  it('feeds technique credit into muscle volume', () => {
    const drop: VolumeSet = { ...sets('ex.curl', 1)[0]!, technique: { kind: 'drop', units: 2 } };
    expect(muscleVolume([drop], creditsOf, RULES).value.get(mu('mu.biceps'))).toEqual({
      fractional: 2,
      direct: 2,
    });
  });
});

describe('weekly bands (EB §Defaults › Volume)', () => {
  it.each([
    [3.5, 'belowFloor'],
    [4, 'low'],
    [9.5, 'low'],
    [10, 'default'],
    [20, 'default'],
    [20.5, 'high'],
    [30, 'high'],
    [31, 'softWarning'],
    [40, 'softWarning'],
    [40.5, 'hardWarning'],
  ] as const)('%f fractional sets → %s', (fractional, band) => {
    const result = classifyWeeklyVolume(fractional, RULES);
    expect(result.value).toBe(band);
    expect(result.why.rule).toBe(`volume.band.${band}`);
    expect(result.why.params[0]).toMatchObject({
      id: 'volume.hypertrophy.weeklyBands',
      verified: true,
    });
  });

  it('nudges above the per-session soft cap (11 fractional or 8 direct sets)', () => {
    expect(checkSessionVolume({ fractional: 11, direct: 8 }, RULES).value).toBe(false);
    expect(checkSessionVolume({ fractional: 11.5, direct: 6 }, RULES).value).toBe(true);
    expect(checkSessionVolume({ fractional: 9, direct: 9 }, RULES).value).toBe(true);
  });
});

describe('weekly totals', () => {
  it('groups by the user’s week start', () => {
    const weeks = weeklyMuscleVolume(
      // Sunday 2026-11-22, Monday 2026-11-23, Wednesday 2026-11-25.
      [
        dated('2026-11-22', 'ex.curl'),
        dated('2026-11-23', 'ex.curl'),
        dated('2026-11-25', 'ex.row'),
      ],
      creditsOf,
      1,
      RULES,
    );
    expect([...weeks.keys()]).toEqual(['2026-11-16', '2026-11-23']);
    expect(weeks.get('2026-11-23' as LocalDate)?.value.get(mu('mu.biceps'))).toEqual({
      fractional: 1.5,
      direct: 1,
    });
    const sundayStart = weeklyMuscleVolume(
      [dated('2026-11-22', 'ex.curl'), dated('2026-11-23', 'ex.curl')],
      creditsOf,
      7,
      RULES,
    );
    expect([...sundayStart.keys()]).toEqual(['2026-11-22']);
  });
});

describe('properties', () => {
  const arbitrarySet = fc.record({
    exerciseId: fc.constantFrom(...Object.keys(MAPPING).map(id)),
    type: fc.constantFrom('working' as const, 'warmup' as const, 'top' as const),
    reps: fc.integer({ min: 1, max: 30 }),
    effort: fc.oneof(
      fc.constant<Effort>({ rir: null, source: 'none' }),
      fc.integer({ min: 0, max: 10 }).map((rir): Effort => entered(rir)),
    ),
  });

  it('volume is additive over sets and independent of their order', () => {
    fc.assert(
      fc.property(fc.array(arbitrarySet), fc.array(arbitrarySet), (a, b) => {
        const total = muscleVolume([...a, ...b], creditsOf, RULES).value;
        const left = muscleVolume(a, creditsOf, RULES).value;
        const right = muscleVolume(b, creditsOf, RULES).value;
        const reversed = muscleVolume([...b, ...a].toReversed(), creditsOf, RULES).value;
        expect([...reversed.keys()]).toEqual([...total.keys()]);
        for (const [muscle, sum] of total) {
          const l = left.get(muscle) ?? { fractional: 0, direct: 0 };
          const r = right.get(muscle) ?? { fractional: 0, direct: 0 };
          expect(sum.fractional).toBeCloseTo(l.fractional + r.fractional, 9);
          expect(sum.direct).toBeCloseTo(l.direct + r.direct, 9);
          expect(reversed.get(muscle)?.fractional).toBeCloseTo(sum.fractional, 9);
        }
      }),
    );
  });
});
