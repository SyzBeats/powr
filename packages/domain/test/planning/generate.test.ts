import { describe, expect, it } from 'vitest';

import type {
  EquipmentDef,
  EquipmentId,
  EquipmentPresetDef,
  ExerciseId,
  MuscleId,
  PresetId,
} from '../../src';
import {
  implementFor,
  isAvailable,
  missingEquipment,
  profileFromPreset,
} from '../../src/equipment';
import {
  effectiveness,
  generatePlan,
  selectTemplate,
  setsOf,
  validatePlan,
} from '../../src/planning';
import { exercise, LIBRARY, PL_TEMPLATE, request, TEMPLATES, lookup } from '../fixtures/planning';
import { rules } from '../fixtures/rules';

const RULES = rules();
const catalog = { exercises: LIBRARY, templates: TEMPLATES };
const id = (value: string) => value as ExerciseId;

describe('equipment availability (EQP-04) and implements (TD-29)', () => {
  const squat = lookup(id('ex.back-squat'))!;

  it('needs every allOf item and one item of each anyOf group, and names what is missing', () => {
    const items = new Set(['eq.barbell-olympic', 'eq.plates', 'eq.squat-stand']);
    expect(isAvailable(squat, items)).toBe(true);
    expect(isAvailable(squat, new Set(['eq.barbell-olympic', 'eq.plates']))).toBe(false);
    expect(missingEquipment(squat, new Set(['eq.plates'])).value).toEqual({
      allOf: ['eq.barbell-olympic'],
      anyOf: [['eq.power-rack', 'eq.squat-stand']],
    });
    expect(isAvailable(squat, { items: items as never, customItems: [] })).toBe(true);
  });

  const catalogItems: EquipmentDef[] = [
    {
      id: 'eq.barbell-olympic' as EquipmentId,
      name: { en: 'Bar' },
      synonyms: [],
      category: 'bar',
      loading: {
        kind: 'bar',
        defaultWeight: [
          { value: 20, unit: 'kg' },
          { value: 45, unit: 'lb' },
        ],
        variesByModel: false,
      },
    },
    {
      id: 'eq.plates' as EquipmentId,
      name: { en: 'Plates' },
      synonyms: [],
      category: 'freeWeight',
      loading: { kind: 'plates' },
    },
    {
      id: 'eq.dumbbells' as EquipmentId,
      name: { en: 'DB' },
      synonyms: [],
      category: 'freeWeight',
      loading: { kind: 'dumbbells' },
    },
    {
      id: 'eq.leg-extension' as EquipmentId,
      name: { en: 'LE' },
      synonyms: [],
      category: 'machine',
      loading: {
        kind: 'stack',
        defaultIncrement: [
          { value: 5, unit: 'kg' },
          { value: 10, unit: 'lb' },
        ],
      },
    },
  ];
  const preset: EquipmentPresetDef = {
    id: 'preset.test' as PresetId,
    name: { en: 'Test' },
    description: { en: 'Test.' },
    items: ['eq.barbell-olympic', 'eq.plates', 'eq.dumbbells', 'eq.leg-extension'] as EquipmentId[],
    inventory: {
      kg: {
        plates: [
          { weight: 20, pairs: 2 },
          { weight: 1.25, pairs: 1 },
        ],
        microplates: [{ weight: 0.5, pairs: 1 }],
        dumbbells: { from: 2.5, to: 30, step: 2.5 },
      },
    },
  };

  it('builds a profile from a preset in the requested unit, falling back to the unit it has', () => {
    const kg = profileFromPreset(preset, catalogItems, { id: 'p', name: 'Gym', unit: 'kg' });
    expect(kg).toMatchObject({
      unit: 'kg',
      bars: [{ item: 'eq.barbell-olympic', weight: { value: 20, unit: 'kg' } }],
      stacks: [{ item: 'eq.leg-extension', increment: { value: 5, unit: 'kg' } }],
      dumbbells: { from: 2.5, to: 30, step: 2.5 },
      collarWeight: 0,
      isDefault: true,
      presetId: 'preset.test',
    });
    expect(profileFromPreset(preset, catalogItems, { id: 'p', name: 'Gym', unit: 'lb' }).unit).toBe(
      'kg',
    );
  });

  it('maps exercises onto the loading implements', () => {
    const profile = profileFromPreset(preset, catalogItems, { id: 'p', name: 'Gym', unit: 'kg' });
    expect(implementFor(lookup(id('ex.deadlift'))!, profile, catalogItems)).toEqual({
      kind: 'barbell',
      bar: { weight: 20, unit: 'kg' },
      plates: {
        unit: 'kg',
        plates: [
          { weight: 20, pairs: 2 },
          { weight: 1.25, pairs: 1 },
          { weight: 0.5, pairs: 1 },
        ],
      },
    });
    expect(implementFor(lookup(id('ex.dumbbell-curl'))!, profile, catalogItems)).toEqual({
      kind: 'steps',
      unit: 'kg',
      start: 2.5,
      step: 2.5,
      max: 30,
    });
    expect(implementFor(lookup(id('ex.leg-extension'))!, profile, catalogItems)).toEqual({
      kind: 'steps',
      unit: 'kg',
      start: 5,
      step: 5,
    });
    expect(implementFor(lookup(id('ex.push-up'))!, profile, catalogItems)).toEqual({
      kind: 'loosePlates',
      plates: expect.objectContaining({ unit: 'kg' }),
    });
    const band = exercise('ex.band-pull-apart', {
      pattern: 'shoulderHorizontalAbduction',
      type: 'band',
      muscles: [['mu.rear-delts', 1]],
    });
    expect(implementFor(band, profile, catalogItems)).toBeNull();
  });
});

describe('MAP-03 ranking', () => {
  it('weighs credit, evidence, stretch, overload and sub-region coverage', () => {
    const squat = effectiveness(lookup(id('ex.back-squat'))!, 'mu.quads' as MuscleId, RULES);
    // credit 1 × 0.4 + H 1 × 0.15 + stretch 1 × 0.15 + overload 3/3 × 0.2 + sub-region 1 × 0.1
    expect(squat.value).toBeCloseTo(1, 10);
    expect(squat.why.children.map((child) => child.rule)).toEqual([
      'ranking.factor.credit',
      'ranking.factor.evidence',
      'ranking.factor.stretch',
      'ranking.factor.overload',
      'ranking.factor.subRegion',
    ]);
    const goblet = effectiveness(
      lookup(id('ex.goblet-squat'))!,
      'mu.quads' as MuscleId,
      RULES,
    ).value;
    expect(goblet).toBeCloseTo(0.4 + 0 + 0.15 + 0.2 / 3, 10);
    const custom = { ...lookup(id('ex.goblet-squat'))!, custom: true };
    expect(effectiveness(custom, 'mu.quads' as MuscleId, RULES).value).toBeCloseTo(0.4, 10);
    expect(
      effectiveness(lookup(id('ex.back-squat'))!, 'mu.glutes' as MuscleId, RULES).value,
    ).toBeGreaterThan(0);
  });
});

describe('template selection (PLN-02)', () => {
  it('takes the cell default, refuses a template for other levels or days, and says why', () => {
    expect(selectTemplate(TEMPLATES, request()).value?.id).toBe('tpl.test-bb-3day');
    expect(selectTemplate(TEMPLATES, request({ weekdays: [1, 2] })).why.rule).toBe(
      'plan.template.none',
    );
    const advancedOnly = { ...PL_TEMPLATE, levels: ['advanced' as const] };
    expect(
      selectTemplate(
        [advancedOnly],
        request({ style: 'powerlifting', level: 'novice', templateId: advancedOnly.id }),
      ).why,
    ).toMatchObject({
      rule: 'plan.template.levelMismatch',
      args: { levels: 'advanced' },
    });
  });
});

describe('plan generation (PLN-01…08)', () => {
  it('fills every slot with an available, non-avoided exercise and explains each choice', () => {
    const result = generatePlan(
      request({ avoid: { exercises: [id('ex.romanian-deadlift')], patterns: ['calf'] } }),
      catalog,
      RULES,
    );
    const proposal = result.value!;
    const used = proposal.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId));
    expect(used).not.toContain('ex.romanian-deadlift');
    expect(used).not.toContain('ex.calf-raise');
    expect(
      proposal.choices.every((choice) =>
        choice.why.params.some((param) => param.id === 'ranking.effectiveness'),
      ),
    ).toBe(true);
    expect(proposal.notes.map((note) => note.rule)).toContain('plan.slot.dropped');
    expect(proposal.report.ok).toBe(true);
  });

  it('prefers a favourite and keeps one exercise per slot within a day', () => {
    const proposal = generatePlan(
      request({ preferred: [id('ex.goblet-squat')] }),
      catalog,
      RULES,
    ).value!;
    expect(proposal.days[0]!.slots.find((slot) => slot.key.endsWith('.squat'))?.exerciseId).toBe(
      'ex.goblet-squat',
    );
    for (const day of proposal.days) {
      expect(new Set(day.slots.map((slot) => slot.exerciseId)).size).toBe(day.slots.length);
    }
  });

  it('caps novices at five working exercises per day (PLN-02)', () => {
    const proposal = generatePlan(request({ level: 'novice' }), catalog, RULES).value!;
    expect(Math.max(...proposal.days.map((day) => day.slots.length))).toBe(5);
  });

  it('sets targets by level, priority and recent volume (PLN-03)', () => {
    const proposal = generatePlan(
      request({
        priorities: ['mu.chest' as MuscleId],
        recentVolume: [{ muscle: 'mu.lats' as MuscleId, sets: 6 }],
      }),
      catalog,
      RULES,
    ).value!;
    const target = (muscle: string) => proposal.targets.find((entry) => entry.muscle === muscle);
    expect(target('mu.quads')).toEqual({ muscle: 'mu.quads', sets: 15, source: 'band' });
    expect(target('mu.chest')).toEqual({ muscle: 'mu.chest', sets: 18, source: 'priority' });
    expect(target('mu.lats')).toEqual({ muscle: 'mu.lats', sets: 7, source: 'recent' });
    expect(target('mu.calves')).toMatchObject({ source: 'maintenance' });
  });

  it('allocates sets within the per-session cap and the time budget (PLN-04, PLN-14)', () => {
    for (const budget of [30, 45, 60, null]) {
      const proposal = generatePlan(request({ sessionMinutes: budget }), catalog, RULES).value!;
      for (const day of proposal.report.analysis.days) {
        expect(day.minutes).toBeLessThanOrEqual((budget ?? Infinity) * 1.1 + 1e-6);
        for (const muscle of day.muscles) expect(muscle.fractional).toBeLessThanOrEqual(11 + 1e-9);
      }
      for (const slot of proposal.days.flatMap((day) => day.slots))
        expect(setsOf(slot.prescription)).toBeLessThanOrEqual(5);
    }
  });

  it('keeps the competition lifts for strength styles and refuses a plan without them', () => {
    const pl = generatePlan(request({ style: 'powerlifting' }), catalog, RULES).value!;
    const heavy = pl.days[0]!.slots.find((slot) => slot.key === 'h.squat')!;
    expect(heavy).toMatchObject({ exerciseId: 'ex.back-squat', progression: 'rpe' });
    expect(heavy.prescription).toEqual({
      mode: 'topBackoff',
      top: { repRange: [1, 3], rir: [1, 2] },
      backoff: { sets: 2, repRange: [3, 5], rir: [2, 3] },
    });
    expect(pl.days[1]!.slots.find((slot) => slot.key === 'l.squat')?.exerciseId).toMatch(/squat/);
    const noRack = generatePlan(
      request({ style: 'powerlifting', equipment: new Set(['eq.dumbbells', 'eq.flat-bench']) }),
      catalog,
      RULES,
    );
    expect(noRack.value).toBeNull();
    expect(noRack.why).toMatchObject({ rule: 'plan.lift.unavailable', args: { lift: 'squat' } });
    const novice = generatePlan(
      request({ style: 'powerlifting', level: 'novice' }),
      catalog,
      RULES,
    ).value!;
    expect(novice.days[0]!.slots[0]!.progression).toBe('linear');
  });

  it('spaces hard sessions: lift days land on non-consecutive weekdays when possible', () => {
    const proposal = generatePlan(
      request({ style: 'powerlifting', weekdays: [1, 2, 4] }),
      catalog,
      RULES,
    ).value!;
    expect(
      proposal.notes.find((note) => note.rule === 'plan.schedule.weekdays')?.args['conflicts'],
    ).toBe(0);
    expect(proposal.days.map((entry) => entry.weekday).toSorted((a, b) => a - b)).toEqual([
      1, 2, 4,
    ]);
  });

  it('is deterministic, and variety mode varies with the seed only', () => {
    expect(generatePlan(request(), catalog, RULES)).toEqual(
      generatePlan(request(), catalog, RULES),
    );
    const varied = (seed: number) =>
      generatePlan(request({ variety: true, seed }), catalog, RULES).value!.days.map((entry) =>
        entry.slots.map((slot) => slot.exerciseId),
      );
    expect(varied(7)).toEqual(varied(7));
    expect(
      new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => JSON.stringify(varied(seed)))).size,
    ).toBeGreaterThan(1);
  });

  it('validates its own output: a generated week passes PLN-01', () => {
    const proposal = generatePlan(request({ sessionMinutes: 60 }), catalog, RULES).value!;
    const again = validatePlan(
      proposal.days,
      {
        style: 'bodybuilding',
        level: 'intermediate',
        sessionMinutes: 60,
        equipment: request().equipment,
        avoid: { exercises: [], patterns: [] },
        targets: proposal.targets,
        liftTargets: [],
        accumulationWeeks: 5,
        deloadWeeks: 1,
        exercise: lookup,
        exercises: LIBRARY,
      },
      RULES,
    );
    expect(
      again.issues.filter((issue) => issue.severity === 'violation' && issue.cause === null),
    ).toEqual([]);
  });
});
