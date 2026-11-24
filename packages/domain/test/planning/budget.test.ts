import { describe, expect, it } from 'vitest';

import type { IsoWeekday, MuscleId, MuscleTarget, PlanDay } from '../../src';
import {
  editsForFix,
  generatePlan,
  validatePlan,
  type PlanProposal,
  type ValidationContext,
} from '../../src/planning';
import {
  ALL_EQUIPMENT,
  day,
  LIBRARY,
  lookup,
  planSlot,
  request,
  TEMPLATES,
} from '../fixtures/planning';
import { rules } from '../fixtures/rules';

/*
 * PLN-14 time-budget prioritisation (product-owner decision, M2b): when the session budget
 * cannot fit every weekly target, the keep-full group (the user's priorities, else the
 * template's emphasis) keeps its full target and the other muscles fall back towards the
 * minimum dose of 4 weekly sets (Iversen 2021); the plan names the time budget and the fixes.
 */

const RULES = rules();
const catalog = { exercises: LIBRARY, templates: TEMPLATES };
const muscle = (value: string) => value as MuscleId;
const MINIMUM_DOSE = 4;

function plan(sessionMinutes: number | null, priorities: readonly string[] = []): PlanProposal {
  return generatePlan(
    request({ sessionMinutes, priorities: priorities.map(muscle) }),
    catalog,
    RULES,
  ).value!;
}

const target = (proposal: PlanProposal, id: string) =>
  proposal.targets.find((entry) => entry.muscle === id)!;
const planned = (proposal: PlanProposal, id: string) =>
  proposal.report.analysis.muscles.find((entry) => entry.muscle === id)?.fractional ?? 0;
const lowered = (proposal: PlanProposal) =>
  proposal.targets.filter((entry) => entry.source === 'timeBudget');

describe('time-budget prioritisation (PLN-14)', () => {
  // The test template: three full-body days; squat (quads, glutes), press (chest) and row
  // (lats, mid-back) are primary, hinge (hamstrings) and curl secondary, triceps and calves
  // optional (maintenance targets). Without a budget every band target fits (about 90 min a day).

  it('keeps the priority muscle at its full target and lowers the others, never below 4 sets', () => {
    const proposal = plan(45, ['mu.hamstrings']);
    expect(target(proposal, 'mu.hamstrings')).toEqual({
      muscle: 'mu.hamstrings',
      sets: 18,
      source: 'priority',
    });
    expect(lowered(proposal).map((entry) => entry.muscle)).toEqual([
      'mu.chest',
      'mu.elbow-flexors',
      'mu.glutes',
      'mu.lats',
      'mu.mid-back',
      'mu.quads',
    ]);
    for (const entry of lowered(proposal)) {
      expect(entry.full).toBe(15);
      expect(entry.sets).toBeGreaterThanOrEqual(MINIMUM_DOSE);
      expect(entry.sets).toBeLessThan(entry.full!);
      // Lowered to what the week achieves (half sets, rounded down): no low-volume issue left.
      expect(planned(proposal, entry.muscle) + 1e-9).toBeGreaterThanOrEqual(entry.sets);
    }
    // Maintenance targets are never lowered.
    expect(target(proposal, 'mu.calves')).toMatchObject({ source: 'maintenance' });
    expect(target(proposal, 'mu.triceps')).toMatchObject({ source: 'maintenance' });
    expect(proposal.report.ok).toBe(true);
  });

  it('flags each lowered target with the time budget and the input fixes', () => {
    const proposal = plan(45, ['mu.hamstrings']);
    const issue = proposal.report.issues.find(
      (entry) => entry.why.rule === 'validate.volume.timeBudget' && entry.key.includes('mu.chest'),
    )!;
    expect(issue).toEqual({
      key: 'volume.timeBudget:mu.chest:6/6/15',
      constraint: 'volume',
      severity: 'warning',
      subject: { kind: 'muscle', muscle: 'mu.chest' },
      cause: 'timeBudget',
      why: expect.objectContaining({
        rule: 'validate.volume.timeBudget',
        args: { muscle: 'mu.chest', sets: 6, target: 6, full: 15 },
      }),
      // The full targets need more than 90 minutes a day here: "90+".
      fixes: [{ kind: 'sessionMinutes', minutes: null }, { kind: 'addDay' }],
    });
    expect(issue.why.params.map((param) => param.id)).toEqual([
      'volume.hypertrophy.minimumDose',
      'planning.timeBudget.fallback',
      'volume.hypertrophy.weeklyBands',
    ]);
    expect(
      proposal.report.issues.filter((entry) => entry.why.rule === 'validate.volume.timeBudget'),
    ).toHaveLength(lowered(proposal).length);
    // The priority muscle stays short of its full target: its issue carries the same fixes.
    const short = proposal.report.issues.find((entry) => entry.key.startsWith('volume.low:'))!;
    expect(short).toMatchObject({
      subject: { kind: 'muscle', muscle: 'mu.hamstrings' },
      severity: 'violation',
      cause: 'timeBudget',
      fixes: [{ kind: 'sessionMinutes', minutes: null }, { kind: 'addDay' }],
    });
  });

  it('explains the lowered targets and the budget in the preview notes', () => {
    const proposal = plan(45, ['mu.hamstrings']);
    const budget = proposal.notes.find((note) => note.rule === 'plan.volume.budget')!;
    expect(budget.args).toEqual({ lowered: 6, minutes: null, emphasis: 'priorities' });
    expect(budget.params.map((param) => param.id)).toEqual([
      'volume.hypertrophy.minimumDose',
      'planning.timeBudget.fallback',
      'volume.hypertrophy.weeklyBands',
    ]);
    const chest = proposal.notes.find(
      (note) => note.rule === 'plan.volume.target' && note.args['muscle'] === 'mu.chest',
    )!;
    expect(chest.args).toEqual({
      muscle: 'mu.chest',
      sets: 6,
      source: 'timeBudget',
      full: 15,
      level: 'intermediate',
      recent: null,
    });
    expect(chest.params.map((param) => param.id)).toContain('volume.hypertrophy.minimumDose');
  });

  it('without priorities keeps the template emphasis (its primary hypertrophy slots) full', () => {
    const proposal = plan(45);
    for (const id of ['mu.chest', 'mu.glutes', 'mu.lats', 'mu.mid-back', 'mu.quads'])
      expect(target(proposal, id)).toEqual({ muscle: id, sets: 15, source: 'band' });
    expect(lowered(proposal).map((entry) => entry.muscle)).toEqual([
      'mu.elbow-flexors',
      'mu.hamstrings',
    ]);
    expect(
      proposal.notes.find((note) => note.rule === 'plan.volume.budget')?.args['emphasis'],
    ).toBe('template');
  });

  it('gives the spare set time to the priority muscle and suggests a concrete budget', () => {
    // At 60 minutes some time is left after the minimum sets: it goes to the priority muscle.
    expect(planned(plan(60), 'mu.hamstrings')).toBe(6);
    expect(planned(plan(60, ['mu.hamstrings']), 'mu.hamstrings')).toBe(15);
    const chest = plan(60, ['mu.chest']);
    expect(planned(chest, 'mu.chest')).toBe(15);
    expect(planned(plan(60), 'mu.chest')).toBe(6);
    // The full targets fit into 90-minute sessions from this week.
    expect(
      chest.report.issues.find((entry) => entry.why.rule === 'validate.volume.timeBudget')?.fixes,
    ).toEqual([{ kind: 'sessionMinutes', minutes: 90 }, { kind: 'addDay' }]);
    expect(chest.notes.find((note) => note.rule === 'plan.volume.budget')?.args['minutes']).toBe(
      90,
    );
  });

  it('changes nothing without a budget', () => {
    const proposal = plan(null, ['mu.hamstrings']);
    expect(lowered(proposal)).toEqual([]);
    expect(proposal.notes.map((note) => note.rule)).not.toContain('plan.volume.budget');
  });
});

const budgetIssues = (days: readonly PlanDay[], ctx: ValidationContext) =>
  validatePlan(days, ctx, RULES).issues.filter(
    (issue) => issue.why.rule === 'validate.volume.timeBudget',
  );

describe('time-budget issues in the plan editor (PLN-09, PLN-14)', () => {
  const week: PlanDay[] = [
    day('a', 1, [planSlot('a.press', 'ex.dumbbell-press', 3)]),
    day('b', 4, [planSlot('b.press', 'ex.dumbbell-press', 3)]),
  ];
  const lowChest: MuscleTarget = {
    muscle: muscle('mu.chest'),
    sets: 6,
    source: 'timeBudget',
    full: 12,
  };
  function context(overrides: Partial<ValidationContext> = {}): ValidationContext {
    return {
      style: 'bodybuilding',
      level: 'intermediate',
      sessionMinutes: 30,
      equipment: ALL_EQUIPMENT,
      avoid: { exercises: [], patterns: [] },
      targets: [lowChest],
      liftTargets: [],
      accumulationWeeks: 5,
      deloadWeeks: 1,
      exercise: lookup,
      exercises: LIBRARY,
      ...overrides,
    };
  }
  it('computes the session budget that fits the full target, in 15-minute steps above the budget', () => {
    const [issue] = budgetIssues(week, context());
    expect(issue?.fixes).toEqual([{ kind: 'sessionMinutes', minutes: 45 }, { kind: 'addDay' }]);
    expect(issue?.why.args).toEqual({ muscle: 'mu.chest', sets: 6, target: 6, full: 12 });
    // Always above the current budget, and "90+" (null) beyond 90 minutes.
    expect(budgetIssues(week, context({ sessionMinutes: 75 }))[0]?.fixes[0]).toEqual({
      kind: 'sessionMinutes',
      minutes: 90,
    });
    expect(budgetIssues(week, context({ sessionMinutes: 90 }))[0]?.fixes[0]).toEqual({
      kind: 'sessionMinutes',
      minutes: null,
    });
  });

  it('offers another day only below six days, and drops the warning once the week reaches full', () => {
    const six = ([1, 2, 3, 4, 5, 6] as const).map((weekday: IsoWeekday) =>
      day(`d${weekday}`, weekday, [planSlot(`d${weekday}.press`, 'ex.dumbbell-press', 1)]),
    );
    expect(budgetIssues(six, context())[0]?.fixes.map((fix) => fix.kind)).toEqual([
      'sessionMinutes',
    ]);
    const full = [
      day('a', 1, [planSlot('a.press', 'ex.dumbbell-press', 6)]),
      day('b', 4, [planSlot('b.press', 'ex.dumbbell-press', 6)]),
    ];
    expect(budgetIssues(full, context())).toEqual([]);
    expect(budgetIssues(week, context({ sessionMinutes: null }))).toEqual([]);
  });

  it('input fixes have no plan edits: the plan is generated again with the new answers', () => {
    expect(editsForFix({ kind: 'sessionMinutes', minutes: 60 }, week)).toEqual([]);
    expect(editsForFix({ kind: 'addDay' }, week)).toEqual([]);
  });
});
