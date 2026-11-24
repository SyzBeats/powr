import { describe, expect, it } from 'vitest';

import type { ExerciseId, MuscleId, PlanDay } from '../../src';
import {
  applyPlanEdits,
  editsForFix,
  slotForExercise,
  validatePlan,
  type ValidationContext,
} from '../../src/planning';
import { ALL_EQUIPMENT, day, LIBRARY, lookup, planSlot } from '../fixtures/planning';
import { rules } from '../fixtures/rules';

const RULES = rules();
const muscle = (value: string) => value as MuscleId;

function context(overrides: Partial<ValidationContext> = {}): ValidationContext {
  return {
    style: 'bodybuilding',
    level: 'intermediate',
    sessionMinutes: null,
    equipment: ALL_EQUIPMENT,
    avoid: { exercises: [], patterns: [] },
    targets: [],
    liftTargets: [],
    accumulationWeeks: 5,
    deloadWeeks: 1,
    exercise: lookup,
    exercises: LIBRARY,
    ...overrides,
  };
}

const codes = (days: readonly PlanDay[], ctx: ValidationContext) =>
  validatePlan(days, ctx, RULES).issues.map((issue) => `${issue.severity}:${issue.why.rule}`);

describe('PLN-01 validation report', () => {
  it('flags an unavailable or avoided exercise with what is missing and a swap fix', () => {
    const week = [day('a', 1, [planSlot('a.squat', 'ex.back-squat', 3)])];
    const report = validatePlan(
      week,
      context({
        equipment: new Set(['eq.dumbbells']),
        avoid: { exercises: [], patterns: ['squat'] },
      }),
      RULES,
    );
    const unavailable = report.issues.find(
      (issue) => issue.why.rule === 'validate.equipment.unavailable',
    )!;
    expect(unavailable).toMatchObject({
      severity: 'violation',
      constraint: 'equipment',
      cause: null,
    });
    expect(unavailable.why.children[0]?.args['missing']).toContain('eq.barbell-olympic');
    expect(report.issues.map((issue) => issue.why.rule)).toContain('validate.avoided');
    expect(report.ok).toBe(false);
    expect(report.constraints.find((entry) => entry.constraint === 'equipment')?.status).toBe(
      'violated',
    );
  });

  it('checks weekly volume against the targets and the bands (PLN-03), with the parameters used', () => {
    const week = [
      day('a', 1, [planSlot('a.press', 'ex.dumbbell-press', 3)]),
      day('b', 4, [planSlot('b.press', 'ex.dumbbell-press', 3)]),
    ];
    const report = validatePlan(
      week,
      context({ targets: [{ muscle: muscle('mu.chest'), sets: 12, source: 'band' }] }),
      RULES,
    );
    const low = report.issues.find((issue) => issue.why.rule === 'validate.volume.low')!;
    expect(low).toMatchObject({
      key: 'volume.low:mu.chest:6',
      cause: null,
      fixes: [{ kind: 'addSets', sets: 1 }],
    });
    expect(low.why.params.map((param) => param.id)).toContain('volume.hypertrophy.weeklyBands');
    const high = [1, 2, 3].map((index) =>
      day(`d${index}`, index as 1, [
        planSlot(`d${index}.press`, 'ex.dumbbell-press', 6),
        planSlot(`d${index}.push`, 'ex.push-up', 6),
      ]),
    );
    expect(
      codes(high, context({ targets: [{ muscle: muscle('mu.chest'), sets: 15, source: 'band' }] })),
    ).toContain('warning:validate.volume.veryHigh');
    expect(
      codes(week, context({ targets: [{ muscle: muscle('mu.chest'), sets: 2, source: 'user' }] })),
    ).toContain('warning:validate.volume.targetOutsideBand');
  });

  it('checks frequency (PLN-04): two sessions per muscle, 2–3 per lift, from three days', () => {
    const week = [
      day('a', 1, [
        planSlot('a.squat', 'ex.back-squat', 3, {
          goal: 'strength',
          lift: 'squat',
          intensity: 'heavy',
        }),
      ]),
      day('b', 3, [planSlot('b.curl', 'ex.dumbbell-curl', 3)]),
      day('c', 5, [planSlot('c.curl', 'ex.dumbbell-curl', 3)]),
    ];
    const issues = codes(
      week,
      context({
        style: 'powerlifting',
        targets: [{ muscle: muscle('mu.quads'), sets: 10, source: 'band' }],
      }),
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        'violation:validate.frequency.muscle',
        'violation:validate.frequency.lift',
        'violation:validate.lift.missing',
      ]),
    );
  });

  it('warns past the per-session caps and flags the strength dose (PLN-03, PLN-04)', () => {
    const week = [
      day('a', 1, [
        planSlot('a.press', 'ex.dumbbell-press', 5),
        planSlot('a.push', 'ex.push-up', 5),
        planSlot('a.bench', 'ex.bench-press', 2, {
          goal: 'strength',
          lift: 'bench',
          intensity: 'heavy',
          prescription: { mode: 'rpe', sets: 2, repRange: [3, 5], rir: [2, 3] },
        }),
      ]),
    ];
    const issues = codes(week, context({ style: 'powerlifting' }));
    expect(issues).toEqual(
      expect.arrayContaining([
        'warning:validate.sessionCap.muscle',
        'violation:validate.strength.belowMinimum',
      ]),
    );
  });

  it('flags a day over budget + 10% with concrete fixes (PLN-14)', () => {
    const week = [
      day('a', 1, [
        planSlot('a.press', 'ex.dumbbell-press', 5),
        planSlot('a.curl', 'ex.dumbbell-curl', 5, { priority: 'optional' }),
        planSlot('a.ext', 'ex.overhead-extension', 5, { priority: 'secondary' }),
      ]),
    ];
    const report = validatePlan(week, context({ sessionMinutes: 20 }), RULES);
    const over = report.issues.find((issue) => issue.why.rule === 'validate.time.overBudget')!;
    expect(over).toMatchObject({ severity: 'violation', cause: null });
    expect(over.fixes.map((fix) => fix.kind)).toEqual(
      expect.arrayContaining(['removeSlot', 'superset', 'techniqueSet', 'timeSaverRest']),
    );
    expect(over.fixes[0]).toMatchObject({ kind: 'removeSlot', slotKey: 'a.curl' });
  });

  it('warns about hard sessions for the same muscle on consecutive days (PLN-04 spacing)', () => {
    const week = [
      day('a', 1, [
        planSlot('a.press', 'ex.dumbbell-press', 5),
        planSlot('a.push', 'ex.push-up', 5),
      ]),
      day('b', 2, [planSlot('b.press', 'ex.dumbbell-press', 3)]),
    ];
    const report = validatePlan(week, context(), RULES);
    expect(report.issues.find((issue) => issue.why.rule === 'validate.spacing')).toMatchObject({
      severity: 'warning',
      subject: { kind: 'day', dayKey: 'b' },
      why: { args: { subject: 'mu.chest', gapHours: 24, requiredHours: 48 } },
    });
  });

  it('checks coverage, lift order, prescriptions and the deload (PLN-05…08)', () => {
    const week = [
      day('a', 1, [
        planSlot('a.leg-ext', 'ex.leg-extension', 3),
        planSlot('a.squat', 'ex.back-squat', 3, {
          goal: 'strength',
          lift: 'squat',
          intensity: 'heavy',
          prescription: { mode: 'rpe', sets: 3, repRange: [3, 5], rir: [0, 1] },
        }),
        planSlot('a.press', 'ex.dumbbell-press', 3, {
          prescription: { mode: 'doubleProgression', sets: 3, repRange: [3, 40], rir: [0, 6] },
        }),
      ]),
    ];
    const issues = codes(
      week,
      context({
        deloadWeeks: 0,
        accumulationWeeks: 10,
        targets: [
          { muscle: muscle('mu.quads'), sets: 10, source: 'band' },
          { muscle: muscle('mu.elbow-flexors'), sets: 10, source: 'band' },
        ],
      }),
    );
    expect(issues).toEqual(
      expect.arrayContaining([
        'warning:validate.coverage',
        'warning:validate.order.lift',
        'warning:validate.prescription.reps',
        'warning:validate.prescription.effort',
        'violation:validate.deload.missing',
        'warning:validate.deload.missing',
      ]),
    );
  });
});

describe('plan editor (PLN-09)', () => {
  const week = {
    days: [
      day('a', 1, [
        planSlot('a.press', 'ex.dumbbell-press', 3),
        planSlot('a.curl', 'ex.dumbbell-curl', 3),
      ]),
    ],
    targets: [],
  };

  it('applies every kind of edit and ignores edits for missing days or slots', () => {
    const edited = applyPlanEdits(
      week,
      [
        { kind: 'setSets', dayKey: 'a', slotKey: 'a.press', sets: 4 },
        {
          kind: 'swapExercise',
          dayKey: 'a',
          slotKey: 'a.curl',
          exerciseId: 'ex.overhead-extension' as ExerciseId,
        },
        { kind: 'moveSlot', dayKey: 'a', slotKey: 'a.curl', toIndex: 0 },
        { kind: 'lockSlot', dayKey: 'a', slotKey: 'a.press', locked: true },
        { kind: 'setRest', dayKey: 'a', slotKey: 'a.press', seconds: 95.4 },
        { kind: 'addDay', dayKey: 'b', name: { en: 'B' }, weekday: 4 },
        {
          kind: 'addSlot',
          dayKey: 'b',
          slot: slotForExercise(
            lookup('ex.lateral-raise' as ExerciseId)!,
            { goal: 'hypertrophy', sets: 3, rir: [1, 2], existingKeys: [] },
            RULES,
          ),
        },
        { kind: 'renameDay', dayKey: 'b', name: { en: 'Shoulders' } },
        { kind: 'setWeekday', dayKey: 'b', weekday: 5 },
        { kind: 'setTarget', muscle: muscle('mu.chest'), sets: 14 },
        { kind: 'setSets', dayKey: 'zz', slotKey: 'nope', sets: 9 },
      ],
      lookup,
      RULES,
    );
    expect(edited.days[0]!.slots.map((slot) => slot.exerciseId)).toEqual([
      'ex.overhead-extension',
      'ex.dumbbell-press',
    ]);
    expect(edited.days[0]!.slots[1]).toMatchObject({
      locked: true,
      restSeconds: 95,
      prescription: { sets: 4 },
    });
    expect(edited.days[1]).toMatchObject({
      key: 'b',
      name: { en: 'Shoulders' },
      weekday: 5,
      slots: [{ key: 'custom.1', exerciseId: 'ex.lateral-raise' }],
    });
    expect(edited.targets).toEqual([{ muscle: 'mu.chest', sets: 14, source: 'user' }]);
    expect(
      applyPlanEdits(
        edited,
        [
          { kind: 'removeDay', dayKey: 'b' },
          { kind: 'removeSlot', dayKey: 'a', slotKey: 'a.press' },
        ],
        lookup,
        RULES,
      ).days,
    ).toHaveLength(1);
  });

  it('turns plan fixes into edits; session-level fixes have none', () => {
    expect(
      editsForFix({ kind: 'removeSets', dayKey: 'a', slotKey: 'a.press', sets: 1 }, week.days),
    ).toEqual([{ kind: 'setSets', dayKey: 'a', slotKey: 'a.press', sets: 2 }]);
    expect(
      editsForFix({ kind: 'addSets', dayKey: 'a', slotKey: 'a.press', sets: 2 }, week.days),
    ).toEqual([{ kind: 'setSets', dayKey: 'a', slotKey: 'a.press', sets: 5 }]);
    expect(
      editsForFix({ kind: 'superset', dayKey: 'a', slotKeys: ['a.press', 'a.curl'] }, week.days),
    ).toEqual([]);
  });
});
