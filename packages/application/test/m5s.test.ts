import { describe, expect, it } from 'vitest';

import type { Baseline, ExerciseId, LocalDate, PresetId } from '@powr/domain';

import { ALERT_DEFAULTS } from '../src';
import {
  completeOnboarding,
  equipmentProfileFromPreset,
  generatePlanPreview,
  previewProfileChange,
  profileAnswers,
  saveProfileChange,
  type OnboardingAnswers,
} from '../src/planning';
import { startWorkout } from '../src/session';
import { prepare } from '../src/session/context';
import {
  exerciseChoices,
  resetExerciseRest,
  resetRestTimes,
  restTimes,
  setAlertSettings,
  setDisplayPreferences,
  setExerciseChoice,
  setRestTime,
  setTrainingParameter,
  setTrainingPreferences,
  setUnits,
  trainingParameters,
} from '../src/settings';
import { createTestDeps } from './fakes';

/*
 * M5s settings use cases: alert settings (TD-42), rest times and their reset (SET-03), training
 * and display preferences (SET-05, SET-10), per-exercise choices (TMR-01, PRG-03), units
 * (SET-02) and one onboarding answer changed with a re-plan only when needed (SET-08).
 */

type Test = ReturnType<typeof createTestDeps>;
const id = (value: string) => value as ExerciseId;
const squat = id('ex.barbell-back-squat');
const bench = id('ex.barbell-bench-press');

function answers(test: Test, overrides: Partial<OnboardingAnswers> = {}): OnboardingAnswers {
  const equipment = equipmentProfileFromPreset(test.deps, {
    presetId: 'preset.commercial-gym' as PresetId,
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
    style: 'bodybuilding',
    phase: 'notTracking',
    experience: {
      trainingAge: 'years2To5',
      timeOff: 'upTo1Week',
      rpeFamiliarity: 'some',
      recentVolume: [],
    },
    levelOverride: null,
    schedule: { weekdays: [1, 3, 5], sessionMinutes: 60 },
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

/** Onboarded with an accepted plan (or only a profile with `plan: false`). */
async function onboarded(test: Test, input = answers(test), plan = true) {
  const preview = plan ? await generatePlanPreview(test.deps, { answers: input }) : null;
  if (preview && !preview.ok) throw new Error('no plan');
  const done = await completeOnboarding(test.deps, {
    answers: input,
    preview: preview ? preview.value : null,
  });
  if (!done.ok) throw new Error(done.error.kind);
  return done.value;
}

const settings = (test: Test) => test.data().settings[0];

describe('alert settings (TD-42)', () => {
  it('stores the required fields with the change, clamps the volume and refuses other timings', async () => {
    const test = createTestDeps();
    const saved = await setAlertSettings(test.deps, { sound: false, volume: 1.4 });
    expect(saved).toEqual({ ok: true, value: { ...ALERT_DEFAULTS, sound: false, volume: 1 } });
    expect(settings(test)?.alerts).toEqual({
      sound: false,
      volume: 1,
      vibration: true,
      preAlert: true,
      preAlertSeconds: 10,
      countdown: false,
      restingNotice: true,
      keepScreenOn: true,
    });
    await setAlertSettings(test.deps, { tempoCues: true, preAlertSeconds: 15 });
    expect(settings(test)?.alerts).toMatchObject({
      sound: false,
      tempoCues: true,
      preAlertSeconds: 15,
    });
    expect(
      await setAlertSettings(test.deps, { preAlertSeconds: 20 as unknown as 5 }),
    ).toMatchObject({ ok: false, error: { kind: 'invalidPreAlertSeconds' } });
  });
});

describe('rest times (SET-03, TMR-02)', () => {
  it('shows the evidence defaults for the user, stores own values and resets them', async () => {
    const test = createTestDeps();
    await onboarded(test);
    const initial = await restTimes(test.deps);
    const strength = initial.times.find((time) => time.id === 'session.rest.strength')!;
    expect(strength).toMatchObject({
      seconds: 180,
      evidenceDefault: 180,
      competitionDefault: 240,
      own: false,
      outOfRange: false,
    });
    expect(initial.times.map((time) => time.id)).toHaveLength(7);

    expect(
      await setRestTime(test.deps, { paramId: 'session.rest.hypertrophyIsolation', seconds: 75 }),
    ).toEqual({ ok: true, value: undefined });
    expect(
      await setRestTime(test.deps, { paramId: 'session.rest.strength', seconds: 600 }),
    ).toEqual({ ok: true, value: undefined });
    const changed = await restTimes(test.deps);
    expect(
      changed.times.find((time) => time.id === 'session.rest.hypertrophyIsolation'),
    ).toMatchObject({ seconds: 75, evidenceDefault: 90, own: true, outOfRange: false });
    // Accepted with a note: outside the 2:30–5:00 the evidence supports (TMR-02).
    expect(changed.times.find((time) => time.id === 'session.rest.strength')).toMatchObject({
      seconds: 600,
      own: true,
      outOfRange: true,
    });

    // The session resolves the user's value for an isolation exercise.
    const prepared = await prepare(test.deps);
    expect(
      prepared.rules(id('ex.dumbbell-lateral-raise'))['session.rest.hypertrophyIsolation'].value,
    ).toBe(75);

    // The default value again removes the override; refusals for the rest.
    await setRestTime(test.deps, { paramId: 'session.rest.strength', seconds: 180 });
    expect(settings(test)?.overrides?.map((entry) => entry.paramId)).toEqual([
      'session.rest.hypertrophyIsolation',
    ]);
    expect(await setRestTime(test.deps, { paramId: 'session.tempo.default', seconds: 60 })).toEqual(
      {
        ok: false,
        error: { kind: 'unknownParam' },
      },
    );
    expect(
      await setRestTime(test.deps, { paramId: 'session.rest.strength', seconds: 12.5 }),
    ).toEqual({ ok: false, error: { kind: 'invalidSeconds' } });

    // A rest remembered for one exercise (TMR-03) is listed and reset with "everything".
    await test.deps.uow.write(['settings'], async (repos) => {
      const current = (await repos.settings.get())!;
      await repos.settings.put({
        ...current,
        overrides: [
          ...(current.overrides ?? []),
          { paramId: 'session.rest.strength', value: 200, exerciseId: squat },
          { paramId: 'load.e1rm.equation', value: 'wathan' },
        ],
      });
    });
    expect((await restTimes(test.deps)).exercises).toEqual([
      { exerciseId: squat, paramId: 'session.rest.strength', seconds: 200 },
    ]);
    expect(await resetRestTimes(test.deps, { exercises: false })).toEqual({ removed: 1 });
    expect(settings(test)?.overrides?.map((entry) => entry.exerciseId ?? entry.paramId)).toEqual([
      squat,
      'load.e1rm.equation',
    ]);
    await resetExerciseRest(test.deps, squat);
    expect(settings(test)?.overrides).toEqual([{ paramId: 'load.e1rm.equation', value: 'wathan' }]);
  });

  it('"reset everything" also forgets the rests remembered per exercise', async () => {
    const test = createTestDeps();
    await onboarded(test);
    await setRestTime(test.deps, { paramId: 'session.rest.timeSaver', seconds: 50 });
    await test.deps.uow.write(['settings'], async (repos) => {
      const current = (await repos.settings.get())!;
      await repos.settings.put({
        ...current,
        overrides: [
          ...(current.overrides ?? []),
          { paramId: 'session.rest.strength', value: 200, exerciseId: squat },
        ],
      });
    });
    expect(await resetRestTimes(test.deps, { exercises: true })).toEqual({ removed: 2 });
    expect(settings(test)?.overrides).toEqual([]);
  });
});

describe('training, display and per-exercise preferences (SET-05, SET-10, TMR-01, PRG-03)', () => {
  it('stores the training and display preferences with their defaults', async () => {
    const test = createTestDeps();
    expect(await setTrainingPreferences(test.deps, { effortScale: 'rpe' })).toEqual({
      effortScale: 'rpe',
      rirInput: 'chips',
      warmups: true,
    });
    expect(await setDisplayPreferences(test.deps, { celebrations: false })).toEqual({
      largeControls: false,
      celebrations: false,
    });
    expect(settings(test)).toMatchObject({
      training: { effortScale: 'rpe' },
      display: { celebrations: false },
    });
  });

  it('starts a workout without warm-up sets when they are switched off', async () => {
    const baseline: Baseline = {
      exerciseId: squat,
      kind: 'oneRepMax',
      load: { value: 150, unit: 'kg' },
      reps: 1,
      rir: 0,
      date: '2026-11-20' as LocalDate,
    };
    const run = async (warmups: boolean) => {
      const test = createTestDeps();
      await onboarded(test, answers(test, { baselines: [baseline] }), false);
      await setTrainingPreferences(test.deps, { warmups });
      const start = await startWorkout(test.deps, {
        source: { kind: 'freestyle', exerciseIds: [squat] },
      });
      if (!start.ok) throw new Error(start.error.kind);
      return start.value.view.exercises[0]!.slot.sets.map((set) => set.type);
    };
    expect(await run(true)).toContain('warmup');
    expect(await run(false)).not.toContain('warmup');
  });

  it('lists the plan exercises with their choices and stores one exercise at a time', async () => {
    const test = createTestDeps();
    await onboarded(test, undefined, true);
    const listed = await exerciseChoices(test.deps);
    expect(listed.length).toBeGreaterThan(3);
    expect(listed.every((entry) => entry.source === 'plan')).toBe(true);
    expect(listed[0]).toMatchObject({ manual: false, restAutoStart: null, restSeconds: null });

    await setExerciseChoice(test.deps, { exerciseId: bench, manual: true, restAutoStart: false });
    expect(settings(test)?.session?.exercises).toEqual([
      { exerciseId: bench, manual: true, restAutoStart: false },
    ]);
    const withChoice = (await exerciseChoices(test.deps)).find(
      (entry) => entry.exerciseId === bench,
    );
    expect(withChoice).toMatchObject({ manual: true, restAutoStart: false });
    // Nothing left: the exercise leaves the stored list.
    await setExerciseChoice(test.deps, { exerciseId: bench, manual: false, restAutoStart: null });
    expect(settings(test)?.session?.exercises).toEqual([]);
    expect(
      await setExerciseChoice(test.deps, { exerciseId: id('ex.unknown'), manual: true }),
    ).toEqual({ ok: false, error: { kind: 'unknownExercise' } });
  });

  it('changes the units of a profile (SET-02)', async () => {
    const test = createTestDeps();
    expect(await setUnits(test.deps, { load: 'lb', bodyweight: 'lb', length: 'in' })).toMatchObject(
      { ok: false, error: { kind: 'noProfile' } },
    );
    await onboarded(test, undefined, false);
    await setUnits(test.deps, { load: 'lb', bodyweight: 'kg', length: 'in' });
    expect(test.data().profile[0]?.units).toEqual({ load: 'lb', bodyweight: 'kg', length: 'in' });
  });
});

describe('advanced training choices (SET-05)', () => {
  it('shows the evidence defaults and stores own values as overrides, back to the default on null', async () => {
    const test = createTestDeps();
    await onboarded(test, undefined, false);
    expect(await trainingParameters(test.deps)).toEqual({
      mainLift: { value: 'rpe', evidenceDefault: 'rpe', own: false },
      accessory: { value: 'doubleProgression', evidenceDefault: 'doubleProgression', own: false },
      equation: { value: 'wathan', evidenceDefault: 'wathan', own: false },
      deloadEveryWeeks: { value: 5, evidenceDefault: 5, own: false, min: 3, max: 8 },
    });
    for (const input of [
      { choice: 'mainLift', value: 'linear' },
      { choice: 'accessory', value: 'rpe' },
      { choice: 'equation', value: 'epley' },
      { choice: 'deloadWeeks', value: 6 },
    ] as const)
      expect(await setTrainingParameter(test.deps, input)).toEqual({ ok: true, value: undefined });
    expect(settings(test)?.overrides).toContainEqual({
      paramId: 'progression.model.mainLift',
      value: { novice: 'linear', intermediate: 'linear', advanced: 'linear' },
    });
    const changed = await trainingParameters(test.deps);
    expect(changed.mainLift).toEqual({ value: 'linear', evidenceDefault: 'rpe', own: true });
    expect(changed.equation).toMatchObject({ value: 'epley', own: true });
    expect(changed.deloadEveryWeeks).toMatchObject({ value: 6, own: true });
    // The session resolves the user's equation.
    expect((await prepare(test.deps)).rules(null)['load.e1rm.equation'].value).toBe('epley');

    await setTrainingParameter(test.deps, { choice: 'equation', value: null });
    expect((await trainingParameters(test.deps)).equation.own).toBe(false);
    for (const input of [
      { choice: 'equation', value: 'lombardi' },
      { choice: 'deloadWeeks', value: 9 },
      { choice: 'accessory', value: 'apre' },
    ] as const)
      expect(await setTrainingParameter(test.deps, input as never)).toEqual({
        ok: false,
        error: { kind: 'invalidValue' },
      });
  });
});

describe('one onboarding answer changed in Settings (SET-08)', () => {
  it('saves an answer that does not change the plan without a re-plan', async () => {
    const test = createTestDeps();
    await onboarded(test);
    const before = test.data().plans.find((plan) => plan.status === 'active')!;
    // The body-weight phase and the birth year do not change the plan.
    const preview = await previewProfileChange(test.deps, { phase: 'cut', birthYear: 1990 });
    expect(preview).toEqual({ ok: true, value: { replan: null } });
    const saved = await saveProfileChange(test.deps, {
      change: { phase: 'cut', birthYear: 1990 },
      replan: null,
    });
    expect(saved).toEqual({ ok: true, value: { replanned: false } });
    expect(test.data().profile[0]).toMatchObject({ phase: 'cut', birthYear: 1990 });
    expect(test.data().plans.find((plan) => plan.status === 'active')?.id).toBe(before.id);
  });

  it('previews a new plan from next week when the answer changes it, and applies it on request', async () => {
    const test = createTestDeps();
    await onboarded(test);
    const before = test.data().plans.find((plan) => plan.status === 'active')!;
    const thisWeek = test
      .data()
      .plannedSessions.filter(
        (session) => session.planId === before.id && session.localDate < '2026-11-30',
      );
    const change = {
      schedule: { weekdays: [1, 2, 4, 5] as const, sessionMinutes: 60, startTimes: [] },
    };
    const preview = await previewProfileChange(test.deps, change);
    if (!preview.ok || !preview.value.replan) throw new Error('expected a re-plan');
    const { replan } = preview.value;
    expect(replan.from).toBe('2026-11-30');
    expect(replan.preview.startDate).toBe('2026-11-30');
    expect(replan.preview.calendar.every((day) => day.date >= '2026-11-30')).toBe(true);
    expect(replan.differences.days).toEqual({ from: 3, to: 4 });
    // Training days belong to the plan: the next block would not pick them up.
    expect(replan.nextBlock).toBe(false);
    // Nothing stored by the preview.
    expect(test.data().plans.filter((plan) => plan.status === 'active')).toHaveLength(1);

    const saved = await saveProfileChange(test.deps, { change, replan });
    expect(saved).toEqual({ ok: true, value: { replanned: true } });
    const plans = test.data().plans;
    expect(plans.find((plan) => plan.id === before.id)?.status).toBe('ended');
    const active = plans.find((plan) => plan.status === 'active')!;
    expect(active.schedule.weekdays).toHaveLength(4);
    expect(active.mesocycles[0]!.startDate).toBe('2026-11-30');
    // This week stays as planned; the old plan's later sessions are gone.
    const sessions = test.data().plannedSessions;
    for (const session of thisWeek) expect(sessions.map((entry) => entry.id)).toContain(session.id);
    expect(
      sessions.some((session) => session.planId === before.id && session.localDate >= '2026-11-30'),
    ).toBe(false);
    expect(sessions.filter((session) => session.planId === active.id).length).toBeGreaterThan(0);
    expect(
      sessions
        .filter((session) => session.planId === active.id)
        .every((session) => session.localDate >= '2026-11-30'),
    ).toBe(true);
  });

  it('keeps the plan when asked; priorities reach the next block by themselves', async () => {
    const test = createTestDeps();
    await onboarded(test);
    const change = { priorities: ['mu.chest', 'mu.back.lats'] as never };
    const preview = await previewProfileChange(test.deps, change);
    if (!preview.ok) throw new Error(preview.error.kind);
    // Priorities change the weekly targets; the next block reads them from the profile.
    expect(preview.value.replan?.nextBlock).toBe(true);
    expect(preview.value.replan?.differences.targets.length).toBeGreaterThan(0);
    const before = test.data().plans.find((plan) => plan.status === 'active')!.id;
    expect(await saveProfileChange(test.deps, { change, replan: null })).toEqual({
      ok: true,
      value: { replanned: false },
    });
    expect(test.data().profile[0]?.priorities).toEqual(['mu.chest', 'mu.back.lats']);
    expect(test.data().plans.find((plan) => plan.status === 'active')?.id).toBe(before);
  });

  it('updates the session length on the plan when it does not change the plan; refuses invalid answers', async () => {
    const test = createTestDeps();
    await onboarded(test);
    const plan = test.data().plans.find((entry) => entry.status === 'active')!;
    const change = {
      schedule: {
        weekdays: [...plan.schedule.weekdays],
        sessionMinutes: 60,
        startTimes: [{ weekday: 1 as const, time: '07:30' }],
      },
    };
    const preview = await previewProfileChange(test.deps, change);
    expect(preview).toEqual({ ok: true, value: { replan: null } });
    await saveProfileChange(test.deps, { change, replan: null });
    const updated = test.data().plans.find((entry) => entry.id === plan.id)!;
    expect(updated.schedule.startTimes).toEqual([{ weekday: 1, time: '07:30' }]);
    expect(updated.revision).toBe(plan.revision + 1);

    expect(
      await previewProfileChange(test.deps, {
        schedule: { weekdays: [1], sessionMinutes: 5, startTimes: [] },
        priorities: ['mu.chest', 'mu.quads', 'mu.glutes', 'mu.calves'] as never,
        birthYear: 1800,
      }),
    ).toEqual({
      ok: false,
      error: {
        kind: 'invalidAnswers',
        fields: ['schedule.weekdays', 'schedule.sessionMinutes', 'priorities', 'birthYear'],
      },
    });
  });

  it('refuses a stale re-plan and works without a plan', async () => {
    const test = createTestDeps();
    expect(await profileAnswers(test.deps)).toBeNull();
    expect(await previewProfileChange(test.deps, { phase: 'bulk' })).toEqual({
      ok: false,
      error: { kind: 'noProfile' },
    });
    await onboarded(test);
    const change = { style: 'powerlifting' as const };
    const preview = await previewProfileChange(test.deps, change);
    if (!preview.ok || !preview.value.replan) throw new Error('expected a re-plan');
    expect(preview.value.replan.differences.template).not.toBeNull();
    // Another plan was accepted in between.
    await onboarded(test);
    expect(await saveProfileChange(test.deps, { change, replan: preview.value.replan })).toEqual({
      ok: false,
      error: { kind: 'stale' },
    });

    const plain = createTestDeps();
    await onboarded(plain, undefined, false);
    expect(await previewProfileChange(plain.deps, change)).toEqual({
      ok: true,
      value: { replan: null },
    });
    const stored = await profileAnswers(plain.deps);
    expect(stored).toMatchObject({ plan: null, profile: { style: 'bodybuilding' } });
    expect(stored?.equipment?.isDefault).toBe(true);
  });

  it('sets the reference values with the sex (ONB-02)', async () => {
    const test = createTestDeps();
    await onboarded(test, undefined, false);
    await saveProfileChange(test.deps, { change: { sex: 'female' }, replan: null });
    expect(test.data().profile[0]).toMatchObject({ sex: 'female', referenceSet: 'female' });
    await saveProfileChange(test.deps, {
      change: { sex: 'preferNotToSay', referenceSet: 'male' },
      replan: null,
    });
    expect(test.data().profile[0]).toMatchObject({ sex: 'preferNotToSay', referenceSet: 'male' });
  });
});
