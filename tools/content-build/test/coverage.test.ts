import { describe, expect, it } from 'vitest';

import {
  COMPETITION_LIFTS,
  MOVEMENT_PATTERNS,
  TRAINING_STYLES,
  type EquipmentId,
} from '@powr/domain';
import { isAvailable } from '@powr/domain/equipment';

import { buildContent } from '../src/build.ts';
import { contentCoverage } from '../src/coverage.ts';

/*
 * Coverage rules (technical concept §8.12 step 3) with their thresholds. Known gaps are listed
 * exactly, so the test fails both when a new gap appears and when a listed gap is closed (then
 * delete it from the list). They are the work list from these first exercises to the MVP library.
 */

/** PRD A-05 and EXL-01: the MVP library has at least 150 exercises (TD-23, M5). */
const MIN_LIBRARY_SIZE = 150;
/** EXL-01: "at least 2 exercises crediting the muscle ≥ 0.5". */
const MIN_EXERCISES_PER_GROUP = 2;
/** Every preset with equipment offers at least this many exercises (EQP-02, EQP-04). */
const MIN_EXERCISES_PER_PRESET = 15;

/** No exercise yet: the contract has no movement pattern for ankle dorsiflexion. */
const GROUPS_WITHOUT_EXERCISES = ['mu.tibialis'];
/**
 * Preset × display group below MIN_EXERCISES_PER_GROUP (EXL-01's per-preset rule). The six M1
 * gaps (bodyweight and bands × calves, forearms, lower back and upper traps; upper traps with
 * dumbbells and a bench and in the hotel gym) were closed in M5 (TD-23).
 */
const KNOWN_PRESET_GAPS: string[] = [];
/**
 * Patterns of MOVEMENT_PATTERNS without an exercise yet: carries need duration or distance
 * defaults, which `ExerciseDefaults` does not have (`repRange` is required).
 */
const PATTERNS_WITHOUT_EXERCISES = ['carry'];
/** PLN-02 style × days cells without a template (none since M2, TD-24). */
const CELLS_WITHOUT_TEMPLATE: string[] = [];
/**
 * TD-37: the alternatives the PLN-02 table names next to a cell's default ("Upper/Lower + PPL
 * hybrid or Full body ×5"), as style × days × split.
 */
const PRD_ALTERNATIVES = ['bodybuilding × 5 × fullBody'];

const { bundle } = buildContent();
if (!bundle) throw new Error('the content does not build; see build.test.ts');
const coverage = contentCoverage(bundle);
const isStandard = (id: string) =>
  bundle.exercises.find((exercise) => exercise.id === id)?.ranking.standard === true;

describe('content coverage', () => {
  it(`ships at least ${MIN_LIBRARY_SIZE} active exercises (PRD A-05)`, () => {
    const active = bundle.exercises.filter((exercise) => exercise.status === 'active');
    expect(active.length).toBeGreaterThanOrEqual(MIN_LIBRARY_SIZE);
  });

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

  it('ships the alternatives PLN-02 names, and only alternatives to a cell with a default (TD-37)', () => {
    const alternatives = bundle.templates.filter((template) => !template.default);
    const named = alternatives.map((t) => `${t.style} × ${t.daysPerWeek} × ${t.split}`);
    for (const alternative of PRD_ALTERNATIVES) expect(named).toContain(alternative);
    // An alternative serves no level its cell's default does not serve (the override then always
    // has a recommended plan to go back to), and differs from it in split.
    const misfits = alternatives.filter((template) => {
      const fallback = bundle.templates.find(
        (t) => t.default && t.style === template.style && t.daysPerWeek === template.daysPerWeek,
      );
      return (
        fallback === undefined ||
        !template.levels.every((level) => fallback.levels.includes(level)) ||
        template.split === fallback.split
      );
    });
    expect(misfits.map((template) => template.id)).toEqual([]);
  });

  it('names a standard variant in every substitution group, never a specialised one (M5z)', () => {
    // The tie-break among equal MAP-03 scores (`ranking.standard`, product owner 2026-11-25):
    // every group offers the common form, so a tie never falls to a specialised variant by ID.
    const groups = new Map<string, string[]>();
    for (const exercise of bundle.exercises) {
      for (const group of exercise.substitutionGroups) {
        if (exercise.ranking.standard)
          groups.set(group, [...(groups.get(group) ?? []), exercise.id]);
        else if (!groups.has(group)) groups.set(group, []);
      }
    }
    expect(
      [...groups].filter(([, standard]) => standard.length === 0).map(([group]) => group),
    ).toEqual([]);
    // The examples the decision names, and the competition lifts over their close variants.
    expect(isStandard('ex.dumbbell-shoulder-press')).toBe(true);
    expect(isStandard('ex.arnold-press')).toBe(false);
    expect(isStandard('ex.incline-dumbbell-curl')).toBe(true);
    expect(isStandard('ex.behind-the-body-cable-curl')).toBe(false);
    for (const exercise of bundle.exercises.filter((entry) => entry.variantOf !== undefined)) {
      expect({ id: exercise.id, standard: exercise.ranking.standard === true }).toEqual({
        id: exercise.id,
        standard: false,
      });
    }
  });
});

const items = (...ids: string[]) => new Set(ids as EquipmentId[]);

describe('equipment availability (EQP-04)', () => {
  const bench = bundle.exercises.find((exercise) => exercise.id === 'ex.barbell-bench-press')!;

  it('needs every allOf item and one item of each anyOf group', () => {
    expect(
      isAvailable(
        bench,
        items('eq.plates', 'eq.barbell-womens', 'eq.flat-bench', 'eq.squat-stand'),
      ),
    ).toBe(true);
    expect(isAvailable(bench, items('eq.plates', 'eq.barbell-olympic', 'eq.flat-bench'))).toBe(
      false,
    );
    expect(isAvailable(bench, items('eq.barbell-olympic', 'eq.flat-bench', 'eq.power-rack'))).toBe(
      false,
    );
  });
});
