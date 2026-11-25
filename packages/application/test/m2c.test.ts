import { describe, expect, it } from 'vitest';

import type { Baseline, ExerciseId, IsoWeekday, PresetId, TemplateId } from '@powr/domain';

import {
  acceptNextMesocycle,
  baselineLifts,
  completeOnboarding,
  equipmentProfileFromPreset,
  estimateBaseline,
  generatePlanPreview,
  proposeNextMesocycle,
  templateChoices,
  type OnboardingAnswers,
} from '../src/planning';
import { createTestDeps } from './fakes';

/*
 * M2c planning gaps: ONB-08 baselines, the PLN-02 template override, the PLN-08 block length
 * and the time-budget step in the next block (TD-36), through the use cases the screens call.
 */

type Test = ReturnType<typeof createTestDeps>;

function answers(
  test: Test,
  overrides: Partial<OnboardingAnswers> = {},
  presetId = 'preset.commercial-gym',
): OnboardingAnswers {
  const equipment = equipmentProfileFromPreset(test.deps, {
    presetId: presetId as PresetId,
    unit: 'kg',
    name: 'Gym',
  });
  if (!equipment.ok) throw new Error('preset missing');
  return {
    units: { load: 'kg', bodyweight: 'kg', length: 'cm' },
    sex: 'preferNotToSay',
    referenceSet: null,
    birthYear: null,
    height: null,
    bodyweight: null,
    style: 'powerlifting',
    phase: 'notTracking',
    experience: {
      trainingAge: 'months6To24',
      timeOff: 'upTo1Week',
      rpeFamiliarity: 'some',
      recentVolume: [],
    },
    levelOverride: null,
    schedule: { weekdays: [1, 3, 5], sessionMinutes: 90 },
    startTimes: [],
    equipment: equipment.value,
    priorities: [],
    avoid: { exercises: [], patterns: [] },
    preferredExercises: [],
    baselines: [],
    meet: null,
    ...overrides,
  };
}

const id = (value: string) => value as ExerciseId;

describe('ONB-08 baselines', () => {
  it('asks for the competition lifts of a strength plan, squat, bench press and deadlift first', async () => {
    const test = createTestDeps();
    const result = await baselineLifts(test.deps, { answers: answers(test), keep: [] });
    expect(result.lifts).toEqual([
      { exerciseId: 'ex.barbell-back-squat', lift: 'squat' },
      { exerciseId: 'ex.barbell-bench-press', lift: 'bench' },
      { exerciseId: 'ex.barbell-deadlift', lift: 'deadlift' },
    ]);
    // Skipped: the calibration fallback (PRG-08), explained with its registry parameter.
    expect(result.fallback).toMatchObject({
      rule: 'e1rm.baseline.none',
      args: { rirMin: 3, rirMax: 4 },
    });
  });

  it('asks a bodybuilder for the main compound lifts of the plan, at most four', async () => {
    const test = createTestDeps();
    const result = await baselineLifts(test.deps, {
      answers: answers(test, { style: 'bodybuilding' }),
      keep: [],
    });
    expect(result.lifts.map((lift) => lift.exerciseId)).toEqual([
      'ex.barbell-back-squat',
      'ex.dumbbell-bench-press',
      'ex.seated-cable-row',
      'ex.barbell-romanian-deadlift',
    ]);
    // The back squat is the competition squat itself; the others are no competition lift.
    expect(result.lifts.map((lift) => lift.lift)).toEqual(['squat', null, null, null]);
  });

  it('keeps lifts the user already gave a baseline for, also without a plan', async () => {
    const test = createTestDeps();
    // Powerlifting without a barbell has no plan (PLN-05): only the kept lift is asked.
    const result = await baselineLifts(test.deps, {
      answers: answers(test, {}, 'preset.dumbbells-bench'),
      keep: [id('ex.barbell-bench-press')],
    });
    expect(result.lifts).toEqual([{ exerciseId: 'ex.barbell-bench-press', lift: 'bench' }]);
  });

  it('estimates the starting e1RM with the rules of the exercise', async () => {
    const test = createTestDeps();
    const baseline: Baseline = {
      exerciseId: id('ex.barbell-back-squat'),
      kind: 'recentSet',
      load: { value: 100, unit: 'kg' },
      reps: 4,
      rir: 2,
    };
    const estimate = await estimateBaseline(test.deps, { baseline, style: 'powerlifting' });
    expect(estimate?.value?.e1rmKg).toBeCloseTo(120.33, 2);
    expect(estimate?.why.rule).toBe('e1rm.baseline');
    const old = await estimateBaseline(test.deps, {
      baseline: { ...baseline, kind: 'oneRepMax', reps: 1, rir: 0, date: '2026-06-01' as never },
      style: 'powerlifting',
    });
    expect(old?.value).toMatchObject({ e1rmKg: 100, old: true });
    expect(
      await estimateBaseline(test.deps, {
        baseline: { ...baseline, exerciseId: id('ex.unknown') },
        style: 'powerlifting',
      }),
    ).toBeNull();
  });

  it('stores the baselines in the profile as given, and rejects ones out of range', async () => {
    const test = createTestDeps();
    const baselines: Baseline[] = [
      {
        exerciseId: id('ex.barbell-back-squat'),
        kind: 'oneRepMax',
        load: { value: 180, unit: 'kg' },
        reps: 1,
        rir: 0,
        date: '2026-10-01' as never,
      },
      {
        exerciseId: id('ex.barbell-bench-press'),
        kind: 'recentSet',
        load: { value: 100, unit: 'kg' },
        reps: 5,
        rir: null,
      },
    ];
    const input = answers(test, { baselines });
    const preview = await generatePlanPreview(test.deps, { answers: input });
    if (!preview.ok) throw new Error(preview.error.kind);
    const done = await completeOnboarding(test.deps, { answers: input, preview: preview.value });
    expect(done.ok).toBe(true);
    const stored = await test.deps.uow.read(['profile'], (repos) => repos.profile.get());
    expect(stored?.baselines).toEqual(baselines);

    for (const bad of [
      { ...baselines[1]!, reps: 0 },
      { ...baselines[1]!, load: { value: 0, unit: 'kg' as const } },
      { ...baselines[1]!, rir: 2.25 },
      { ...baselines[0]!, reps: 3 },
    ]) {
      const result = await completeOnboarding(test.deps, {
        answers: answers(test, { baselines: [bad] }),
        preview: null,
      });
      expect(result).toEqual({
        ok: false,
        error: { kind: 'invalidAnswers', fields: ['baselines'] },
      });
    }
    const twice = await completeOnboarding(test.deps, {
      answers: answers(test, { baselines: [baselines[0]!, baselines[0]!] }),
      preview: null,
    });
    expect(twice.ok).toBe(false);
  });
});

describe('PLN-02 template override', () => {
  it('lists the templates of the style, the recommended one first, each with the generator verdict', async () => {
    const test = createTestDeps();
    const { level, choices } = await templateChoices(test.deps, answers(test));
    expect(level).toBe('intermediate');
    expect(choices.map((choice) => [choice.template.id, choice.recommended, choice.fits])).toEqual([
      ['tpl.pl-sbd-3day', true, true],
      ['tpl.pl-sbd-2day', false, false],
      ['tpl.pl-sbd-4day', false, false],
      ['tpl.pl-sbd-5day', false, false],
      ['tpl.pl-sbd-6day', false, false],
    ]);
    // Days: the existing refusal text; level: the PL 6-day template is for advanced lifters.
    expect(choices[1]!.why).toMatchObject({
      rule: 'plan.template.none',
      args: { reason: 'mismatch' },
    });
    const six = await templateChoices(
      test.deps,
      answers(test, { schedule: { weekdays: [1, 2, 3, 4, 5, 6], sessionMinutes: 90 } }),
    );
    expect(six.choices.find((choice) => choice.template.id === 'tpl.pl-sbd-6day')).toMatchObject({
      recommended: false,
      fits: false,
      why: { rule: 'plan.template.levelMismatch' },
    });
  });

  it('offers the alternative of the same days next to the recommended plan (TD-37)', async () => {
    const test = createTestDeps();
    const five = answers(test, {
      style: 'bodybuilding',
      schedule: { weekdays: [1, 2, 3, 5, 6] as IsoWeekday[], sessionMinutes: 90 },
    });
    const { choices } = await templateChoices(test.deps, five);
    const fitting = choices
      .filter((choice) => choice.fits)
      .map((choice) => [choice.template.id, choice.recommended]);
    // PLN-02 names "Upper/Lower + PPL hybrid or Full body ×5" for this cell.
    expect(fitting).toEqual([
      ['tpl.bb-upper-lower-ppl-5day', true],
      ['tpl.bb-full-body-5day', false],
    ]);
    expect(
      choices.find((choice) => choice.template.id === 'tpl.bb-full-body-5day')!.why,
    ).toMatchObject({
      rule: 'plan.template.chosen',
      args: { split: 'fullBody' },
    });
    const chosen = await generatePlanPreview(test.deps, {
      answers: five,
      options: { templateId: 'tpl.bb-full-body-5day' as TemplateId },
    });
    expect(chosen.ok && chosen.value.why.rule).toBe('plan.template.chosen');
    expect(chosen.ok && chosen.value.proposal.days.map((day) => day.key)).toEqual([
      'a',
      'b',
      'c',
      'd',
      'e',
    ]);
    // Four and six days have an alternative too; a novice is not offered the six-day one.
    const fourDays = { weekdays: [1, 2, 4, 5] as IsoWeekday[], sessionMinutes: 90 };
    const four = await templateChoices(
      test.deps,
      answers(test, { style: 'bodybuilding', schedule: fourDays }),
    );
    expect(
      four.choices.filter((choice) => choice.fits).map((choice) => choice.template.id),
    ).toEqual(['tpl.bb-upper-lower-4day', 'tpl.bb-full-body-4day']);
    const sixDays = { weekdays: [1, 2, 3, 4, 5, 6] as IsoWeekday[], sessionMinutes: 90 };
    const six = await templateChoices(
      test.deps,
      answers(test, { style: 'bodybuilding', schedule: sixDays }),
    );
    expect(six.choices.filter((choice) => choice.fits).map((choice) => choice.template.id)).toEqual(
      ['tpl.bb-ppl-6day', 'tpl.bb-upper-lower-6day'],
    );
    const novice = await templateChoices(
      test.deps,
      answers(test, {
        style: 'bodybuilding',
        schedule: sixDays,
        experience: {
          trainingAge: 'under6Months',
          timeOff: 'upTo1Week',
          rpeFamiliarity: 'none',
          recentVolume: [],
        },
      }),
    );
    expect(
      novice.choices.find((choice) => choice.template.id === 'tpl.bb-upper-lower-6day'),
    ).toMatchObject({ fits: false, why: { rule: 'plan.template.levelMismatch' } });
  });

  it('generates the chosen template, or refuses it with the reason', async () => {
    const test = createTestDeps();
    const four = answers(test, {
      style: 'bodybuilding',
      schedule: { weekdays: [1, 2, 4, 5] as IsoWeekday[], sessionMinutes: 45 },
    });
    const chosen = await generatePlanPreview(test.deps, {
      answers: four,
      options: { templateId: 'tpl.bb-upper-lower-4day' as TemplateId },
    });
    expect(chosen.ok && chosen.value.why.rule).toBe('plan.template.chosen');
    // The time budget shows as the usual issues and note (PLN-14).
    expect(
      chosen.ok &&
        chosen.value.proposal.report.issues.some((issue) => issue.cause === 'timeBudget'),
    ).toBe(true);
    const wrongDays = await generatePlanPreview(test.deps, {
      answers: four,
      options: { templateId: 'tpl.bb-full-body-3day' as TemplateId },
    });
    expect(!wrongDays.ok && wrongDays.error).toMatchObject({
      kind: 'noPlan',
      why: { rule: 'plan.template.none', args: { reason: 'mismatch' } },
    });
    // Missing equipment: a powerlifting template without a barbell names what is missing.
    const noBar = await generatePlanPreview(test.deps, {
      answers: answers(test, {}, 'preset.dumbbells-bench'),
      options: { templateId: 'tpl.pl-sbd-3day' as TemplateId },
    });
    expect(!noBar.ok && noBar.error.why?.rule).toBe('plan.lift.unavailable');
  });
});

describe('PLN-08 block length', () => {
  it('offers the registry range with the template default and generates the chosen length', async () => {
    const test = createTestDeps();
    const input = answers(test);
    const standard = await generatePlanPreview(test.deps, { answers: input });
    if (!standard.ok) throw new Error(standard.error.kind);
    expect(standard.value.blockLength).toEqual({ min: 3, max: 8, defaultWeeks: 5 });
    expect(
      standard.value.proposal.notes.find((note) => note.rule === 'plan.mesocycle')?.args,
    ).toMatchObject({ accumulationWeeks: 5, valid: true, defaultWeeks: 5, chosen: false });

    const longer = await generatePlanPreview(test.deps, {
      answers: input,
      options: { accumulationWeeks: 7 },
    });
    if (!longer.ok) throw new Error(longer.error.kind);
    expect(longer.value.proposal.accumulationWeeks).toBe(7);
    expect(
      longer.value.proposal.notes.find((note) => note.rule === 'plan.mesocycle')?.args,
    ).toMatchObject({ accumulationWeeks: 7, defaultWeeks: 5, chosen: true });

    // Accepted: seven training weeks, then the deload week.
    const done = await completeOnboarding(test.deps, { answers: input, preview: longer.value });
    if (!done.ok || !done.value.plan) throw new Error('no plan');
    const sessions = await test.deps.uow.read(['plannedSessions'], (repos) =>
      repos.plannedSessions.byPlan(done.value.plan!.id),
    );
    expect(Math.max(...sessions.map((session) => session.week))).toBe(8);
    expect(new Set(sessions.filter((s) => s.kind === 'deload').map((s) => s.week))).toEqual(
      new Set([8]),
    );

    const outside = await generatePlanPreview(test.deps, {
      answers: input,
      options: { accumulationWeeks: 9 },
    });
    expect(!outside.ok && outside.error.why).toMatchObject({
      rule: 'plan.mesocycle',
      args: { valid: false },
    });
  });
});

describe('TD-36 next block and the time budget (PLN-13, PLN-14)', () => {
  it('lowers the same targets as the first plan at 45 minutes, with the budget note', async () => {
    const test = createTestDeps();
    const input = answers(test, {
      style: 'bodybuilding',
      schedule: { weekdays: [1, 2, 4, 5] as IsoWeekday[], sessionMinutes: 45 },
    });
    const preview = await generatePlanPreview(test.deps, { answers: input });
    if (!preview.ok) throw new Error(preview.error.kind);
    const done = await completeOnboarding(test.deps, { answers: input, preview: preview.value });
    if (!done.ok || !done.value.plan) throw new Error('no plan');
    const first = preview.value.proposal.targets.filter((t) => t.source === 'timeBudget');
    expect(first.length).toBeGreaterThan(0);

    const next = await proposeNextMesocycle(test.deps, done.value.plan.id);
    if (!next.ok) throw new Error(next.error.kind);
    const lowered = next.value.proposal.mesocycle.targets.filter((t) => t.source === 'timeBudget');
    expect(lowered.map((t) => t.muscle)).toEqual(first.map((t) => t.muscle));
    expect(next.value.proposal.notes.some((note) => note.rule === 'plan.volume.budget')).toBe(true);
    expect(next.value.proposal.report.ok).toBe(true);
    const accepted = await acceptNextMesocycle(test.deps, next.value);
    expect(accepted.ok).toBe(true);
  });
});
