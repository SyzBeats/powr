import { describe, expect, it } from 'vitest';

import {
  COMPETITION_LIFTS,
  MOVEMENT_PATTERNS,
  TRAINING_STYLES,
  type EquipmentId,
} from '@powr/domain';

import { buildContent } from '../src/build.ts';
import { contentCoverage, isAvailable } from '../src/coverage.ts';

/*
 * Coverage rules (technical concept §8.12 step 3) with their thresholds. Known gaps are listed
 * exactly, so the test fails both when a new gap appears and when a listed gap is closed (then
 * delete it from the list). They are the work list from these first exercises to the MVP library.
 */

/** EXL-01: "at least 2 exercises crediting the muscle ≥ 0.5". */
const MIN_EXERCISES_PER_GROUP = 2;
/** Every preset with equipment offers at least this many exercises (EQP-02, EQP-04). */
const MIN_EXERCISES_PER_PRESET = 15;

/** No exercise yet: the M1 contract has no movement pattern for ankle dorsiflexion. */
const GROUPS_WITHOUT_EXERCISES = ['mu.tibialis'];
/** Preset × display group below MIN_EXERCISES_PER_GROUP (EXL-01's per-preset rule), for M4. */
const KNOWN_PRESET_GAPS = [
  'preset.bodyweight-bands × mu.calves',
  'preset.bodyweight-bands × mu.forearms',
  'preset.bodyweight-bands × mu.lower-back',
  'preset.bodyweight-bands × mu.upper-traps',
  'preset.dumbbells-bench × mu.upper-traps',
  'preset.hotel-gym × mu.upper-traps',
];
/** Patterns of MOVEMENT_PATTERNS without an exercise yet. */
const PATTERNS_WITHOUT_EXERCISES = ['carry'];
/** PLN-02 style × days cells without a template yet (M2). */
const CELLS_WITHOUT_TEMPLATE = [
  'bodybuilding × 2',
  'powerlifting × 2',
  'powerlifting × 5',
  'powerlifting × 6',
  'powerbuilding × 2',
  'powerbuilding × 3',
  'powerbuilding × 5',
  'powerbuilding × 6',
];

const { bundle } = buildContent();
if (!bundle) throw new Error('the content does not build; see build.test.ts');
const coverage = contentCoverage(bundle);

describe('content coverage', () => {
  it(`gives every display group ≥ ${MIN_EXERCISES_PER_GROUP} exercises crediting it ≥ 0.5`, () => {
    const thin = [...coverage.groups]
      .filter(([, ids]) => ids.length < MIN_EXERCISES_PER_GROUP)
      .map(([group]) => group);
    expect(thin).toEqual(GROUPS_WITHOUT_EXERCISES);
    // Only optional groups (PRD §7.2 "Could") may be missing.
    for (const group of GROUPS_WITHOUT_EXERCISES) {
      expect(bundle.muscles.find((muscle) => muscle.id === group)?.optional).toBe(true);
    }
  });

  it('gives every sub-region at least one exercise that credits or ranks it (MAP-07)', () => {
    const missing = [...coverage.subRegions].filter(([, ids]) => ids.length === 0);
    expect(missing).toEqual([]);
  });

  it(`offers ≥ ${MIN_EXERCISES_PER_PRESET} exercises under every preset with equipment`, () => {
    const small = [...coverage.presets]
      .filter(([, { available }]) => available.length < MIN_EXERCISES_PER_PRESET)
      .map(([preset, { available }]) => `${preset}: ${available.length}`);
    expect(small).toEqual([]);
    // "Custom (empty)" is the only preset without equipment; everything bodyweight-only fits it.
    expect(bundle.presets.filter((preset) => preset.items.length === 0).map((p) => p.id)).toEqual([
      'preset.custom',
    ]);
  });

  it(`covers every display group with ≥ ${MIN_EXERCISES_PER_GROUP} exercises per preset, except the known gaps`, () => {
    const gaps = [...coverage.presets]
      .flatMap(([preset, { groups }]) =>
        [...groups]
          .filter(
            ([group, ids]) =>
              ids.length < MIN_EXERCISES_PER_GROUP && !GROUPS_WITHOUT_EXERCISES.includes(group),
          )
          .map(([group]) => `${preset} × ${group}`),
      )
      .toSorted();
    expect(gaps).toEqual(KNOWN_PRESET_GAPS);
  });

  it('flags every competition lift and gives each a close variant (EXL-07)', () => {
    const missing = COMPETITION_LIFTS.filter((lift) => {
      const ids = new Set(
        bundle.exercises
          .filter((exercise) => exercise.competitionLift === lift)
          .map((exercise) => exercise.id),
      );
      return !bundle.exercises.some(
        (exercise) => exercise.variantOf !== undefined && ids.has(exercise.variantOf),
      );
    });
    expect(missing).toEqual([]);
  });

  it('has an exercise for every movement pattern except the known ones', () => {
    const used = new Set(bundle.exercises.map((exercise) => exercise.pattern));
    expect(MOVEMENT_PATTERNS.filter((pattern) => !used.has(pattern))).toEqual(
      PATTERNS_WITHOUT_EXERCISES,
    );
  });

  it('ships a default template for every PLN-02 cell except the known ones', () => {
    const missing = TRAINING_STYLES.flatMap((style) =>
      [2, 3, 4, 5, 6]
        .filter(
          (days) =>
            !bundle.templates.some((t) => t.style === style && t.daysPerWeek === days && t.default),
        )
        .map((days) => `${style} × ${days}`),
    );
    expect(missing).toEqual(CELLS_WITHOUT_TEMPLATE);
  });
});

const items = (...ids: string[]) => new Set(ids as EquipmentId[]);

describe('equipment availability (EQP-04)', () => {
  const bench = bundle.exercises.find((exercise) => exercise.id === 'ex.barbell-bench-press')!;

  it('needs every allOf item and one item of each anyOf group', () => {
    expect(
      isAvailable(
        bench.equipment,
        items('eq.plates', 'eq.barbell-womens', 'eq.flat-bench', 'eq.squat-stand'),
      ),
    ).toBe(true);
    expect(
      isAvailable(bench.equipment, items('eq.plates', 'eq.barbell-olympic', 'eq.flat-bench')),
    ).toBe(false);
    expect(
      isAvailable(bench.equipment, items('eq.barbell-olympic', 'eq.flat-bench', 'eq.power-rack')),
    ).toBe(false);
  });
});
