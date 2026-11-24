import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { builtInContent } from '@powr/content/built-in';
import { MOVEMENT_PATTERNS, type IsoWeekday } from '@powr/domain';
import { isAvailable } from '@powr/domain/equipment';
import { generatePlan, type PlanRequest } from '@powr/domain/planning';
import { TRAINEE_LEVELS, type RuleSet, type TraineeLevel } from '@powr/domain/rules';
import { BUILT_IN_RULES } from '@powr/rules/built-in';
import { resolveRules } from '@powr/rules/resolve';

/** `FC_NUM_RUNS=<n>` runs these properties that often (vitest.setup.ts). */
const runs = (fallback: number) => fc.readConfigureGlobal().numRuns ?? fallback;

const content = builtInContent();
const templates = content.templates();
const exercises = content.exercises();
const items = content.equipment().items.map((item) => item.id);
const groups = content.muscles().groups.map((group) => group.id);

const rulesCache = new Map<string, RuleSet>();
const rulesFor = (level: TraineeLevel, style: string) => {
  const key = `${level}/${style}`;
  if (!rulesCache.has(key))
    rulesCache.set(key, resolveRules(BUILT_IN_RULES, { level, style: style as never }).rules);
  return rulesCache.get(key)!;
};

/** Any plan request: a template, a level, weekdays, a budget, equipment, priorities, avoid list. */
const request: fc.Arbitrary<PlanRequest> = fc
  .record({
    template: fc.constantFrom(...templates),
    level: fc.constantFrom(...TRAINEE_LEVELS),
    useTemplate: fc.boolean(),
    weekdays: fc.shuffledSubarray([1, 2, 3, 4, 5, 6, 7] as IsoWeekday[], {
      minLength: 6,
      maxLength: 6,
    }),
    weekStartsOn: fc.constantFrom(1, 7) as fc.Arbitrary<IsoWeekday>,
    budget: fc.constantFrom(30, 45, 60, 75, 90, null),
    equipment: fc.subarray(items, { minLength: 0 }),
    priorities: fc.subarray(groups, { maxLength: 3 }),
    avoidPatterns: fc.subarray([...MOVEMENT_PATTERNS], { maxLength: 3 }),
    avoidExercises: fc.subarray(
      exercises.map((exercise) => exercise.id),
      { maxLength: 6 },
    ),
    preferred: fc.subarray(
      exercises.map((exercise) => exercise.id),
      { maxLength: 3 },
    ),
    variety: fc.boolean(),
    seed: fc.nat(),
  })
  .map((input) => ({
    style: input.template.style,
    level: input.level,
    weekdays: input.weekdays.slice(0, input.template.daysPerWeek),
    weekStartsOn: input.weekStartsOn,
    sessionMinutes: input.budget,
    equipment: new Set<string>(input.equipment),
    priorities: input.priorities,
    avoid: { exercises: input.avoidExercises, patterns: input.avoidPatterns },
    preferred: input.preferred,
    recentVolume: [],
    ...(input.useTemplate ? { templateId: input.template.id } : {}),
    variety: input.variety,
    seed: input.seed,
  }));

const generate = (input: PlanRequest, catalog = { exercises, templates }) =>
  generatePlan(input, catalog, rulesFor(input.level, input.style));

describe('plan generation properties (PLN-01, EQP-04, EXL-08)', () => {
  it('is deterministic: same request and seed give the same plan, whatever the content order', () => {
    fc.assert(
      fc.property(request, fc.nat(), (input, salt) => {
        const shuffled = {
          exercises: exercises.toSorted((a, b) => hash(a.id, salt) - hash(b.id, salt)),
          templates: templates.toSorted((a, b) => hash(a.id, salt) - hash(b.id, salt)),
        };
        expect(generate(input, shuffled)).toEqual(generate(input));
      }),
      { numRuns: runs(60) },
    );
  }, 120_000);

  it('never suggests an unavailable or avoided exercise, in the plan or among the alternatives', () => {
    fc.assert(
      fc.property(request, (input) => {
        const proposal = generate(input).value;
        if (!proposal) return;
        const suggested = [
          ...proposal.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId)),
          ...proposal.choices.flatMap((choice) =>
            choice.candidates.map((candidate) => candidate.exerciseId),
          ),
        ];
        for (const id of suggested) {
          const exercise = content.exercise(id)!;
          expect({ id, available: isAvailable(exercise, input.equipment) }).toEqual({
            id,
            available: true,
          });
          expect(input.avoid.exercises).not.toContain(id);
          expect(input.avoid.patterns).not.toContain(exercise.pattern);
        }
        expect(proposal.report.issues.filter((issue) => issue.constraint === 'equipment')).toEqual(
          [],
        );
      }),
      { numRuns: runs(100) },
    );
  }, 120_000);

  it('lowers targets for the time budget only with a budget, never below the minimum dose or for a priority muscle', () => {
    fc.assert(
      fc.property(request, (input) => {
        const proposal = generate(input).value;
        if (!proposal) return;
        const rules = rulesFor(input.level, input.style);
        const minimumDose = rules['volume.hypertrophy.minimumDose'].value.setsPerWeek;
        const lowered = proposal.targets.filter((target) => target.source === 'timeBudget');
        expect(input.sessionMinutes === null ? lowered : []).toEqual([]);
        for (const target of lowered) {
          expect({ ...target, priority: input.priorities.includes(target.muscle) }).toEqual({
            ...target,
            priority: false,
          });
          expect(target.sets).toBeGreaterThanOrEqual(minimumDose);
          expect(target.full).toBeGreaterThan(target.sets);
        }
        for (const target of proposal.targets) {
          expect(target.full === undefined).toBe(target.source !== 'timeBudget');
        }
        expect(
          proposal.notes.some((note) => note.rule === 'plan.volume.budget'),
          'a budget note exactly when a target was lowered',
        ).toBe(lowered.length > 0);
      }),
      { numRuns: runs(100) },
    );
  }, 120_000);

  it('offers a longer session (or "90+") and another day for every time-budget issue', () => {
    fc.assert(
      fc.property(request, (input) => {
        const proposal = generate(input).value;
        if (!proposal || input.sessionMinutes === null) return;
        const budget = input.sessionMinutes;
        const issues = proposal.report.issues.filter(
          (issue) =>
            issue.why.rule === 'validate.volume.timeBudget' ||
            ((issue.why.rule === 'validate.volume.low' ||
              issue.why.rule === 'validate.volume.belowFloor') &&
              issue.cause === 'timeBudget'),
        );
        for (const issue of issues) {
          const longer = issue.fixes.find((fix) => fix.kind === 'sessionMinutes');
          const minutes = longer?.kind === 'sessionMinutes' ? longer.minutes : undefined;
          expect({
            key: issue.key,
            // A longer session than now, at most 90 minutes, or null ("90+").
            longer:
              minutes === null || (minutes !== undefined && minutes > budget && minutes <= 90),
            addDay: issue.fixes.some((fix) => fix.kind === 'addDay'),
          }).toEqual({ key: issue.key, longer: true, addDay: proposal.days.length < 6 });
        }
        expect(
          proposal.report.issues.filter((issue) => issue.why.rule === 'validate.volume.timeBudget'),
        ).toHaveLength(proposal.targets.filter((target) => target.source === 'timeBudget').length);
      }),
      { numRuns: runs(100) },
    );
  }, 120_000);

  it('either plans without avoidable violations or explains why it cannot', () => {
    fc.assert(
      fc.property(request, (input) => {
        const result = generate(input);
        const explained = [
          'plan.template.none',
          'plan.template.levelMismatch',
          'plan.lift.unavailable',
        ];
        expect({
          avoidable: (result.value?.report.issues ?? []).filter(
            (issue) => issue.severity === 'violation' && issue.cause === null,
          ),
          unexplained: result.value === null && !explained.includes(result.why.rule),
        }).toEqual({ avoidable: [], unexplained: false });
      }),
      { numRuns: runs(100) },
    );
  }, 120_000);
});

/** A cheap, salted string hash for shuffling deterministically. */
function hash(text: string, salt: number): number {
  let value = salt | 0;
  for (let index = 0; index < text.length; index++)
    value = Math.imul(value ^ text.charCodeAt(index), 2_654_435_761);
  return value >>> 0;
}
