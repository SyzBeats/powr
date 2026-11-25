import { describe, expect, it } from 'vitest';

import {
  type ExerciseDef,
  type ExerciseId,
  type InstantTz,
  type LocalDate,
  type MuscleId,
} from '../../src';
import { muscleRanking } from '../../src/analytics';
import { firstReadingPerDay, measurementSeries, rateBand } from '../../src/bodyweight';
import {
  buildCustomExercise,
  customDraftFrom,
  exerciseInfo,
  fold,
  searchLibrary,
  type CustomExerciseInput,
  type LibraryUser,
} from '../../src/library';
import { effectiveness } from '../../src/planning';
import { exercise } from '../fixtures/planning';
import { rules } from '../fixtures/rules';

/*
 * The library (EXL-02…05, EXL-07…09), the body-map ranking (MAP-02/03) and the bodyweight rate
 * band and measurements (BOD-02/03).
 */

const RULES = rules();
const LIBRARY: readonly ExerciseDef[] = [
  {
    ...exercise('ex.barbell-bench-press', {
      pattern: 'horizontalPush',
      lift: 'bench',
      allOf: ['eq.barbell', 'eq.bench'],
      muscles: [
        ['mu.chest', 1],
        ['mu.triceps', 0.5],
      ],
      evidence: 'H',
      overload: 3,
    }),
    name: { en: 'Barbell bench press' },
    synonyms: ['Développé couché', 'flat bench'],
    substitutionGroups: ['sg.press'],
  },
  {
    ...exercise('ex.close-grip-bench', {
      pattern: 'horizontalPush',
      variantOf: 'ex.barbell-bench-press',
      allOf: ['eq.barbell', 'eq.bench'],
      muscles: [
        ['mu.triceps', 1],
        ['mu.chest', 0.5],
      ],
    }),
    name: { en: 'Close-grip bench press' },
    substitutionGroups: ['sg.press'],
  },
  {
    ...exercise('ex.dumbbell-curl', {
      pattern: 'elbowFlexion',
      mechanics: 'isolation',
      allOf: ['eq.dumbbells'],
      muscles: [['mu.elbow-flexors', 1]],
      stretch: false,
      overload: 2,
    }),
    name: { en: 'Dumbbell curl' },
  },
  {
    ...exercise('ex.incline-curl', {
      pattern: 'elbowFlexion',
      mechanics: 'isolation',
      allOf: ['eq.dumbbells', 'eq.bench'],
      muscles: [['mu.elbow-flexors.biceps', 1]],
      stretch: true,
      evidence: 'H',
    }),
    name: { en: 'Incline dumbbell curl' },
  },
  {
    ...exercise('ex.dumbbell-row', {
      pattern: 'horizontalPull',
      allOf: ['eq.dumbbells', 'eq.bench'],
      muscles: [
        ['mu.lats', 1],
        ['mu.elbow-flexors', 0.5],
        ['mu.mid-back', 0.5],
      ],
    }),
    name: { en: 'One-arm dumbbell row' },
  },
  {
    ...exercise('ex.cable-curl', {
      pattern: 'elbowFlexion',
      mechanics: 'isolation',
      allOf: ['eq.cable'],
      muscles: [['mu.elbow-flexors', 1]],
    }),
    name: { en: 'Cable curl' },
  },
];
const DUMBBELLS_AND_BENCH: ReadonlySet<string> = new Set(['eq.dumbbells', 'eq.bench']);
const user = (extra: Partial<LibraryUser> = {}): LibraryUser => ({
  equipment: DUMBBELLS_AND_BENCH,
  favourites: [],
  hidden: [],
  avoid: { exercises: [], patterns: [] },
  ...extra,
});

const ids = (query: Parameters<typeof searchLibrary>[1], extra?: Partial<LibraryUser>) =>
  searchLibrary(LIBRARY, query, user(extra)).map((item) => item.exerciseId);

describe('library search and filters (EXL-02)', () => {
  it('finds by name and synonym prefixes, accents and case ignored, best match first', () => {
    expect(fold('Développé')).toBe('developpe');
    expect(
      searchLibrary(LIBRARY, { text: 'developpe' }, user()).map((item) => [
        item.exerciseId,
        item.match,
      ]),
    ).toEqual([['ex.barbell-bench-press', 'synonym']]);
    expect(
      searchLibrary(LIBRARY, { text: 'bench' }, user()).map((item) => item.exerciseId),
    ).toEqual(['ex.barbell-bench-press', 'ex.close-grip-bench']);
    expect(searchLibrary(LIBRARY, { text: 'curl db' }, user())).toEqual([]);
    expect(
      searchLibrary(LIBRARY, { text: 'dumb cur' }, user()).map((item) => item.exerciseId),
    ).toEqual(['ex.dumbbell-curl', 'ex.incline-curl']);
    expect(
      searchLibrary(LIBRARY, { text: 'dumbbell curl' }, user()).map((item) => [
        item.exerciseId,
        item.relevance,
      ]),
    ).toEqual([
      ['ex.dumbbell-curl', 100],
      ['ex.incline-curl', 70],
    ]);
  });

  it('combines filters with AND (muscle, equipment, pattern, mechanics, available only)', () => {
    expect(ids({ muscles: ['mu.elbow-flexors' as MuscleId] })).toEqual([
      'ex.cable-curl',
      'ex.dumbbell-curl',
      'ex.incline-curl',
      'ex.dumbbell-row',
    ]);
    expect(
      ids({
        muscles: ['mu.elbow-flexors' as MuscleId],
        availableOnly: true,
        mechanics: ['isolation'],
      }),
    ).toEqual(['ex.dumbbell-curl', 'ex.incline-curl']);
    expect(ids({ equipment: ['eq.barbell'], patterns: ['horizontalPush'] })).toEqual([
      'ex.barbell-bench-press',
      'ex.close-grip-bench',
    ]);
    expect(ids({}, { hidden: ['ex.cable-curl' as ExerciseId] })).not.toContain('ex.cable-curl');
    expect(ids({ includeHidden: true }, { hidden: ['ex.cable-curl' as ExerciseId] })).toContain(
      'ex.cable-curl',
    );
  });

  it('gives the detail data: muscles with roles and evidence, missing equipment, variants and substitutes (EXL-03/07)', () => {
    const info = exerciseInfo(LIBRARY[0]!, LIBRARY, user());
    expect(info.muscles.map((muscle) => [muscle.muscle, muscle.role, muscle.evidence])).toEqual([
      ['mu.chest', 'primary', 'H'],
      ['mu.triceps', 'secondary', 'H'],
    ]);
    expect(info.equipment).toMatchObject({
      available: false,
      missing: { allOf: ['eq.barbell'], anyOf: [] },
    });
    expect(info.relations).toMatchObject({
      lift: 'bench',
      variantOf: null,
      variants: ['ex.close-grip-bench'],
      substitutes: [{ exerciseId: 'ex.close-grip-bench', available: false }],
    });
    expect(exerciseInfo(LIBRARY[1]!, LIBRARY, user()).relations).toMatchObject({
      lift: 'bench',
      variantOf: 'ex.barbell-bench-press',
    });
  });
});

describe('the body map ranking (MAP-02, MAP-03)', () => {
  it('lists only available exercises with dumbbells and a bench, and the curls rank above rows (MAP-02 example)', () => {
    const ranked = muscleRanking(
      {
        muscle: 'mu.elbow-flexors' as MuscleId,
        mode: 'effectiveness',
        exercises: LIBRARY,
        equipment: DUMBBELLS_AND_BENCH,
        avoid: { exercises: [], patterns: [] },
        hidden: [],
        favourites: [],
        history: () => null,
        includeUnavailable: false,
      },
      RULES,
    );
    expect(ranked.map((entry) => entry.exerciseId)).toEqual([
      'ex.incline-curl',
      'ex.dumbbell-curl',
      'ex.dumbbell-row',
    ]);
    expect(ranked.every((entry) => entry.available)).toBe(true);
    expect(ranked[2]).toMatchObject({ role: 'secondary', credit: 0.5 });
    expect(ranked[0]!.effectiveness.why.children.map((child) => child.rule)).toContain(
      'ranking.factor.stretch',
    );
  });

  it('sorts by Focus (primary first, then the share of the exercise’s credits) and adds unavailable ones last', () => {
    const ranked = muscleRanking(
      {
        muscle: 'mu.elbow-flexors' as MuscleId,
        mode: 'focus',
        exercises: LIBRARY,
        equipment: DUMBBELLS_AND_BENCH,
        avoid: { exercises: [], patterns: [] },
        hidden: ['ex.dumbbell-curl' as ExerciseId],
        favourites: [],
        history: (id) =>
          id === 'ex.incline-curl' ? { lastDate: '2026-11-01' as LocalDate, last: null } : null,
        includeUnavailable: true,
      },
      RULES,
    );
    expect(ranked.map((entry) => [entry.exerciseId, entry.available])).toEqual([
      ['ex.incline-curl', true],
      ['ex.dumbbell-row', true],
      ['ex.cable-curl', false],
    ]);
    expect(ranked[1]!.focus.value).toBeCloseTo(0.5 / 2, 9);
    expect(ranked[2]!.missing).toEqual({ allOf: ['eq.cable'], anyOf: [] });
  });

  it('treats custom exercises as unrated unless the user rated them (EXL-04, MAP-03)', () => {
    const custom = { ...LIBRARY[3]!, id: 'cx.custom' as ExerciseId, custom: true };
    const unrated = effectiveness(custom, 'mu.elbow-flexors' as MuscleId, RULES).value;
    const rated = effectiveness(
      { ...custom, userRated: true },
      'mu.elbow-flexors' as MuscleId,
      RULES,
    ).value;
    expect(rated).toBeGreaterThan(unrated);
    expect(unrated).toBeCloseTo(RULES['ranking.effectiveness'].value.weights.credit, 9);
  });
});

describe('custom exercises (EXL-04)', () => {
  const now: InstantTz = { epochMs: 1_795_456_000_000, offsetMin: 60, zone: 'Europe/Zurich' };
  const ctx = {
    id: 'cx.belt-squat' as ExerciseId,
    now,
    exercises: LIBRARY,
    isMuscle: (id: MuscleId) => id.startsWith('mu.'),
    isEquipment: (id: string) => id.startsWith('eq.') || id === 'ce.hook',
  };
  const input: CustomExerciseInput = {
    name: 'Belt squat',
    pattern: 'squat',
    mechanics: 'compound',
    equipment: { allOf: ['eq.belt' as never], anyOf: [['eq.plates' as never, 'ce.hook' as never]] },
    muscles: [
      { muscle: 'mu.quads' as MuscleId, credit: 1 },
      { muscle: 'mu.glutes.max' as MuscleId, credit: 0.5 },
    ],
    load: { type: 'machine', curveClass: 'legPressLike', unilateral: false },
    repRange: { strength: [3, 6], hypertrophy: [8, 15] },
    restClass: 'hypertrophyCompound',
  };

  it('builds a custom exercise with convention credits and the user-defined source', () => {
    const built = buildCustomExercise(input, ctx);
    if (!built.ok) throw new Error(JSON.stringify(built.issues));
    expect(built.exercise).toMatchObject({
      id: 'cx.belt-squat',
      custom: true,
      status: 'active',
      load: { curveClass: 'legPressLike', bodyweightLoaded: false },
      defaults: { tempo: '2-0-X-0', fixedRom: false },
      createdAt: now,
    });
    expect(
      built.exercise.muscles.every(
        (credit) => credit.evidence === 'C' && credit.source === 'src.powr-user-defined',
      ),
    ).toBe(true);
  });

  it('lists every problem: duplicate name, a group with its own sub-region, no primary, unknown equipment, variant of a variant', () => {
    const built = buildCustomExercise(
      {
        ...input,
        name: 'flat bench',
        muscles: [
          { muscle: 'mu.quads' as MuscleId, credit: 0.5 },
          { muscle: 'mu.quads.vasti' as MuscleId, credit: 0.5 },
        ],
        equipment: { allOf: ['zz.unknown' as never], anyOf: [] },
        variantOf: 'ex.close-grip-bench' as ExerciseId,
        load: { type: 'band', curveClass: 'equation', unilateral: false, bodyweightLoaded: true },
      },
      ctx,
    );
    expect(built.ok).toBe(false);
    if (built.ok) return;
    expect(built.issues).toEqual([
      { field: 'name', code: 'duplicate' },
      { field: 'equipment', code: 'unknownItem', item: 'zz.unknown' },
      { field: 'muscles', code: 'noPrimary' },
      { field: 'muscles', code: 'groupAndSubRegion', muscle: 'mu.quads.vasti' },
      { field: 'load', code: 'bodyweightFlag' },
      { field: 'variantOf', code: 'variantOfVariant' },
    ]);
  });

  it('drafts a copy of a built-in exercise (a competition lift becomes its variant)', () => {
    const draft = customDraftFrom(LIBRARY[0]!);
    expect(draft).toMatchObject({
      name: '',
      variantOf: 'ex.barbell-bench-press',
      pattern: 'horizontalPush',
    });
    expect(draft.muscles).toEqual([
      { muscle: 'mu.chest', credit: 1 },
      { muscle: 'mu.triceps', credit: 0.5 },
    ]);
  });
});

const entry = (id: string, date: string, epochMs: number) => ({
  id,
  localDate: date as LocalDate,
  measuredAt: { epochMs },
});

const at = (date: string, value: number, unit: 'cm' | 'in', epochMs = 0) => ({
  id: date,
  site: 'waist',
  localDate: date as LocalDate,
  measuredAt: { epochMs },
  value,
  unit,
});

describe('bodyweight rate band and measurements (BOD-01…03)', () => {
  it('compares the weekly rate with the phase band (EB: cut 0.5–0.7%, bulk 0.25–0.5% novice)', () => {
    expect(rateBand([-0.6], 'cut', 'intermediate', RULES).value).toMatchObject({
      status: 'in',
      band: { min: -0.7, max: -0.5 },
    });
    expect(rateBand([-0.3], 'cut', 'intermediate', RULES).value.status).toBe('above');
    expect(rateBand([0.6], 'bulk', 'novice', RULES).value).toMatchObject({
      status: 'above',
      band: { min: 0.25, max: 0.5 },
    });
    expect(rateBand([0.2], 'bulk', 'advanced', RULES).value.status).toBe('in');
    expect(rateBand([0.1], 'maintain', 'novice', RULES).value.status).toBe('in');
    expect(rateBand([0.1], 'notTracking', 'novice', RULES).value).toMatchObject({
      status: 'untracked',
      band: null,
    });
    expect(rateBand([null], 'cut', 'novice', RULES).value.status).toBe('insufficientData');
  });

  it('warns only on sustained rates, never on one week (cut > 1% for 2 weeks, bulk above band for 3)', () => {
    expect(rateBand([-1.2], 'cut', 'novice', RULES).value.warning).toBe('none');
    expect(rateBand([-1.2, -1.1], 'cut', 'novice', RULES).value.warning).toBe('fastLoss');
    expect(rateBand([-1.2, -0.9], 'cut', 'novice', RULES).value.warning).toBe('none');
    expect(rateBand([0.8, 0.7], 'bulk', 'novice', RULES).value.warning).toBe('none');
    expect(rateBand([0.8, 0.7, 0.6], 'bulk', 'novice', RULES).value.warning).toBe('fastGain');
  });

  it('uses each day’s first reading (BOD-01)', () => {
    expect(
      firstReadingPerDay([
        entry('b', '2026-11-01', 9),
        entry('a', '2026-11-01', 7),
        entry('c', '2026-11-02', 1),
      ]).map((e) => e.id),
    ).toEqual(['a', 'c']);
  });

  it('builds a measurement series in the latest unit with the change since the first and over four weeks', () => {
    const series = measurementSeries('waist', [
      at('2026-09-01', 33, 'in'),
      at('2026-10-01', 82, 'cm'),
      at('2026-10-30', 80, 'cm'),
    ]);
    expect(series.unit).toBe('cm');
    expect(series.points.map((point) => point.value)).toEqual([33 * 2.54, 82, 80]);
    expect(series.sinceFirst).toBeCloseTo(80 - 83.82, 9);
    expect(series.fourWeeks).toBeCloseTo(-2, 9);
  });
});
