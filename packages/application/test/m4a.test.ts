import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import type { Baseline, ExerciseId, LocalDate, MuscleId, PresetId, SessionId } from '@powr/domain';
import type { SessionView } from '@powr/domain/session';

import { finishSession, logSet, setWeekStart } from '../src';
import {
  bodyweightOverview,
  deleteBodyweight,
  editBodyweight,
  ensureInsights,
  exerciseHistory,
  exerciseTrend,
  homeView,
  logBodyweight,
  logMeasurement,
  markWeekAsBreak,
  measurementsOverview,
  observeHome,
  prHistory,
  progressionAdvice,
  rebuildInsights,
  scores,
  sessionHistory,
  sessionStreakChange,
  streakView,
  trainingCalendar,
  updateInsightPreferences,
  weeklyVolume,
  compareTrends,
  exercisePerformance,
  observeBodyweight,
  observeWeeklyVolume,
  volumeHistory,
  type HomeView,
} from '../src/insights';
import {
  addExerciseToToday,
  customExerciseDraft,
  deleteCustomExercise,
  exerciseDetail,
  muscleExercises,
  observeSessionSetups,
  planPlacements,
  saveCustomExercise,
  saveExerciseUserData,
  searchExercises,
  setFavourite,
  setHidden,
} from '../src/library';
import {
  completeOnboarding,
  equipmentProfileFromPreset,
  generatePlanPreview,
  previewPlanEdit,
  type OnboardingAnswers,
} from '../src/planning';
import {
  deletePastSession,
  dispatch,
  editPastSession,
  finishWorkout,
  logPastSession,
  startWorkout,
} from '../src/session';
import { applyImport, exportBackup, previewImport } from '../src/usecases/backup';
import { createTestDeps } from './fakes';

/** Test environment (no Node types in this project). */
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/*
 * M4a use cases on the in-memory fakes: the derived weeks and the streak after finish, edit,
 * delete, backdating and import (and a property: they always equal a full rebuild), Home, volume
 * against targets with the body-map data, trends and history, scores, bodyweight and
 * measurements, the library with custom exercises, the body map's actions.
 */

type Test = ReturnType<typeof createTestDeps>;
const id = (value: string) => value as ExerciseId;
const kg = (value: number) => ({ value, unit: 'kg' as const });
const SQUAT = id('ex.barbell-back-squat');
const BENCH = id('ex.barbell-bench-press');
const CURL = id('ex.dumbbell-curl');
const ROW = id('ex.one-arm-dumbbell-row');

function answers(
  test: Test,
  options: { preset?: string; style?: OnboardingAnswers['style'] } = {},
): OnboardingAnswers {
  const equipment = equipmentProfileFromPreset(test.deps, {
    presetId: (options.preset ?? 'preset.commercial-gym') as PresetId,
    unit: 'kg',
    name: 'Gym',
  });
  if (!equipment.ok) throw new Error('preset missing');
  const baselines: Baseline[] = [
    {
      exerciseId: SQUAT,
      kind: 'oneRepMax',
      load: kg(150),
      reps: 1,
      rir: 0,
      date: '2026-11-20' as LocalDate,
    },
  ];
  return {
    units: { load: 'kg', bodyweight: 'kg', length: 'cm' },
    sex: 'male',
    referenceSet: 'male',
    birthYear: null,
    height: null,
    bodyweight: kg(83),
    style: options.style ?? 'powerlifting',
    phase: 'cut',
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
    baselines: options.style === 'bodybuilding' ? [] : baselines,
    meet: null,
  };
}

async function onboarded(test: Test, options: Parameters<typeof answers>[1] = {}) {
  const input = answers(test, options);
  const preview = await generatePlanPreview(test.deps, { answers: input });
  if (!preview.ok) throw new Error('no plan');
  const done = await completeOnboarding(test.deps, { answers: input, preview: preview.value });
  if (!done.ok) throw new Error(done.error.kind);
}

async function confirmAll(test: Test, view: SessionView): Promise<SessionView> {
  let current = view;
  for (let guard = 0; current.current && guard < 60; guard++) {
    const set = current.current.value;
    const outcome = await dispatch(test.deps, {
      type: 'CONFIRM_SET',
      slotKey: set.slotKey,
      setKey: set.setKey,
      values: { load: set.load ?? kg(20), reps: set.reps ?? 8, rir: set.rir ?? 2 },
      confirmImplausible: true,
    });
    if (!outcome.ok) throw new Error(JSON.stringify(outcome.error));
    current = outcome.value.view;
  }
  return current;
}

async function finishedPlannedSession(test: Test) {
  const planned = test
    .data()
    .plannedSessions.toSorted((a, b) => (a.localDate < b.localDate ? -1 : 1))
    .find((session) => session.slots.some((slot) => slot.exerciseId === SQUAT))!;
  const start = await startWorkout(test.deps, {
    source: { kind: 'planned', plannedSessionId: planned.id },
  });
  if (!start.ok) throw new Error(start.error.kind);
  await confirmAll(test, start.value.view);
  const finish = await finishWorkout(test.deps, { as: 'finished' });
  if (!finish.ok) throw new Error(finish.error.kind);
  return { planned, finish: finish.value };
}

const day = (test: Test, offset: number) => {
  const today = new Date(test.deps.clock.now().epochMs).toISOString().slice(0, 10);
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10) as LocalDate;
};

async function logPast(
  test: Test,
  offset: number,
  exercises: { exerciseId: ExerciseId; loads: number[]; reps?: number; rir?: number | null }[],
) {
  const result = await logPastSession(test.deps, {
    localDate: day(test, offset),
    exercises: exercises.map((entry) => ({
      exerciseId: entry.exerciseId,
      sets: entry.loads.map((load) => ({
        load: kg(load),
        reps: entry.reps ?? 8,
        rir: entry.rir === undefined ? 2 : entry.rir,
      })),
    })),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
  return result.value;
}

/** dWeekly and dStreak, sorted, for comparing two states. */
function derived(test: Test) {
  const data = test.data();
  return {
    weeks: data.dWeekly.toSorted((a, b) => (a.weekStart < b.weekStart ? -1 : 1)),
    streak: data.dStreak,
  };
}

describe('derived weeks and streak (TD-43)', () => {
  it('rebuild the week after a finished workout; the volume equals the session summary', async () => {
    const test = createTestDeps();
    await onboarded(test);
    const { finish } = await finishedPlannedSession(test);
    await ensureInsights(test.deps);
    const week = test
      .data()
      .dWeekly.find((record) => record.sessions.ids.includes(finish.view.session.id))!;
    expect(week).toBeDefined();
    expect(week.sessions).toMatchObject({ finished: 1, counting: 1 });
    expect(week.lifts.find((lift) => lift.lift === 'squat')?.sets).toBeGreaterThan(0);
    // One calculation (ANL-03): the week's display-group volume equals the summary's.
    const summary = finish.summary!;
    for (const row of summary.volume) {
      const logged = week.muscles.find((entry) => entry.muscle === row.muscle);
      expect(logged?.fractional).toBeCloseTo(row.fractional, 9);
      expect(logged?.direct).toBeCloseTo(row.direct, 9);
    }
    expect(test.data().dStreak[0]?.streak.thisWeek?.done).toBeGreaterThanOrEqual(1);
  });

  it('follow edits, deletes, backdated sessions and the M0 quick log; equal a full rebuild', async () => {
    const test = createTestDeps();
    const past = await logPast(test, -10, [{ exerciseId: CURL, loads: [12, 12, 12] }]);
    await logPast(test, -3, [{ exerciseId: ROW, loads: [30, 30] }]);
    await ensureInsights(test.deps);
    const curlWeek = () =>
      test
        .data()
        .dWeekly.flatMap((record) => record.muscles)
        .find((row) => row.muscle === ('mu.elbow-flexors' as MuscleId));
    expect(test.data().dWeekly).toHaveLength(2);
    await editPastSession(test.deps, {
      sessionId: past.session.id,
      edits: [{ kind: 'addSet', exerciseId: CURL, values: { load: kg(12), reps: 8, rir: 1 } }],
    });
    await ensureInsights(test.deps);
    expect(
      test.data().dWeekly.find((record) => record.sessions.ids.includes(past.session.id))!
        .exercises[0]!.sets,
    ).toBe(4);
    await deletePastSession(test.deps, past.session.id);
    await logSet(test.deps, { exerciseId: CURL, values: { load: kg(10), reps: 10, rir: 2 } });
    await finishSession(test.deps);
    await ensureInsights(test.deps);
    expect(test.data().dWeekly).toHaveLength(2);
    expect(curlWeek()).toBeDefined();
    const before = derived(test);
    await rebuildInsights(test.deps);
    expect(derived(test)).toEqual(before);
    // A new week start changes every week: even a ranged rebuild redoes the whole history.
    await setWeekStart(test.deps, 7);
    await ensureInsights(test.deps, { from: day(test, -7), to: day(test, 0) });
    expect(test.data().dWeekly.every((record) => record.weekStart.length === 10)).toBe(true);
    const sundays = derived(test);
    expect(sundays.weeks.map((record) => new Date(record.weekStart).getUTCDay())).toEqual(
      sundays.weeks.map(() => 0),
    );
    await rebuildInsights(test.deps);
    expect(derived(test)).toEqual(sundays);
  });

  it('equal a full rebuild after any sequence of finish, edit, delete, backdating, break and import (property)', async () => {
    const op = fc.oneof(
      fc.record({
        kind: fc.constant('log' as const),
        offset: fc.integer({ min: 0, max: 40 }),
        exercise: fc.constantFrom(CURL, ROW, BENCH),
        sets: fc.integer({ min: 1, max: 4 }),
        rir: fc.option(fc.integer({ min: 0, max: 5 }), { nil: null }),
      }),
      fc.record({ kind: fc.constant('quick' as const), exercise: fc.constantFrom(CURL, ROW) }),
      fc.record({ kind: fc.constant('edit' as const), pick: fc.nat() }),
      fc.record({ kind: fc.constant('delete' as const), pick: fc.nat() }),
      fc.record({ kind: fc.constant('advance' as const), days: fc.integer({ min: 1, max: 9 }) }),
      fc.record({ kind: fc.constant('break' as const), weeksBack: fc.integer({ min: 0, max: 5 }) }),
      fc.record({ kind: fc.constant('import' as const) }),
      fc.record({ kind: fc.constant('ensure' as const), offset: fc.integer({ min: 0, max: 30 }) }),
    );
    await fc.assert(
      fc.asyncProperty(fc.array(op, { minLength: 1, maxLength: 7 }), async (ops) => {
        const test = createTestDeps();
        for (const step of ops) {
          const sessions = test.data().sessions.filter((session) => session.status === 'finished');
          const target =
            sessions.length > 0
              ? sessions[('pick' in step ? step.pick : 0) % sessions.length]!
              : null;
          switch (step.kind) {
            case 'log':
              await logPast(test, -step.offset, [
                {
                  exerciseId: step.exercise,
                  loads: Array.from({ length: step.sets }, () => 40),
                  rir: step.rir,
                },
              ]);
              break;
            case 'quick':
              await logSet(test.deps, {
                exerciseId: step.exercise,
                values: { load: kg(20), reps: 10, rir: 2 },
              });
              await finishSession(test.deps);
              break;
            case 'edit': {
              if (!target) break;
              const set = test.data().sets.find((entry) => entry.sessionId === target.id);
              await editPastSession(test.deps, {
                sessionId: target.id,
                edits: set
                  ? [
                      { kind: 'deleteSet', setId: set.id },
                      {
                        kind: 'addSet',
                        exerciseId: CURL,
                        values: { load: kg(14), reps: 9, rir: 1 },
                      },
                    ]
                  : [{ kind: 'note', note: 'x' }],
              });
              break;
            }
            case 'delete':
              if (target) await deletePastSession(test.deps, target.id);
              break;
            case 'advance':
              test.advanceDays(step.days);
              break;
            case 'break': {
              await markWeekAsBreak(test.deps, {
                weekStart: day(test, -7 * step.weeksBack),
                reason: 'illness',
              });
              break;
            }
            case 'import': {
              await exportBackup(test.deps);
              const preview = await previewImport(test.deps, test.savedFiles.at(-1)!.bytes);
              if (!preview.ok) throw new Error(preview.error.kind);
              await applyImport(test.deps, preview.value);
              break;
            }
            case 'ensure':
              await ensureInsights(test.deps, { from: day(test, -step.offset), to: day(test, 0) });
              break;
          }
        }
        await ensureInsights(test.deps);
        const incremental = derived(test);
        await rebuildInsights(test.deps);
        expect(derived(test)).toEqual(incremental);
      }),
      { numRuns: env['CI'] ? 25 : 40 },
    );
  }, 120_000);
});

describe('Home (ANL-01)', () => {
  it('shows the next session, the last one, the week against the plan, the streak, PRs and bodyweight', async () => {
    const test = createTestDeps();
    await onboarded(test);
    const before = await homeView(test.deps);
    expect(before.refreshing).toBe(true);
    const { finish } = await finishedPlannedSession(test);
    await ensureInsights(test.deps);
    const home = await homeView(test.deps);
    expect(home.refreshing).toBe(false);
    expect(home.lastSession).toMatchObject({
      sessionId: finish.view.session.id,
      status: 'finished',
    });
    expect(home.lastSession!.doneSets).toBeGreaterThan(0);
    expect(home.next).not.toBeNull();
    expect(home.week.progress).toMatchObject({ weekStart: home.weekStart });
    expect(home.week.volume.length).toBe(19);
    expect(
      home.week.volume.find((row) => row.muscle === ('mu.quads' as MuscleId))!.fractional,
    ).toBeGreaterThan(0);
    expect(home.streak).not.toBeNull();
    expect(home.bodyweight).toMatchObject({ latestKg: 83 });
    expect(home.bodyweight!.band.value.phase).toBe('cut');
    expect(home.scores?.formulas.map((formula) => formula.formula)).toContain('ipfGl');
  });

  it('is live: a logged bodyweight re-emits, a stale week rebuilds in the background', async () => {
    const test = createTestDeps();
    await onboarded(test);
    const views: HomeView[] = [];
    const subscription = observeHome(test.deps).subscribe({ next: (view) => views.push(view) });
    await expect.poll(() => views.at(-1)?.refreshing, { timeout: 5000 }).toBe(false);
    await logBodyweight(test.deps, { mass: kg(82) });
    await expect
      .poll(() => views.at(-1)?.bodyweight?.latestDate !== undefined && views.length > 1, {
        timeout: 5000,
      })
      .toBe(true);
    subscription.unsubscribe();
  });
});

describe('volume against targets and the body map (ANL-03, MAP-04)', () => {
  it('rows per display group with regions per view, the plan targets and the planned remainder', async () => {
    const test = createTestDeps();
    await onboarded(test, { style: 'bodybuilding' });
    // Into the plan's first week, so its targets are in force.
    const start = test.data().plans[0]!.mesocycles[0]!.startDate;
    while (day(test, 0) < start) test.advanceDays(1);
    await logPast(test, 0, [{ exerciseId: CURL, loads: [12, 12, 12, 12] }]);
    const view = await weeklyVolume(test.deps);
    expect(view.rows.map((row) => row.muscle)).toContain('mu.elbow-flexors');
    const biceps = view.rows.find((row) => row.muscle === ('mu.elbow-flexors' as MuscleId))!;
    expect(biceps.fractional).toBe(4);
    expect(biceps.regions).toEqual({ front: 'front.elbow-flexors' });
    expect(biceps.contributors).toEqual([{ exerciseId: CURL, sets: 4, credit: 1, fractional: 4 }]);
    expect(biceps.targeted).toBe(true);
    expect(view.regions.front.map((entry) => entry.region)).toContain('front.chest');
    expect(view.regions.back.map((entry) => entry.region)).toContain('back.side-delts');
    const average = await weeklyVolume(test.deps, { mode: 'avg4' });
    expect(average.weeks).toHaveLength(4);
  });
});

describe('library and body map (EXL-02…09, MAP-02…05)', () => {
  it('ranks biceps exercises for "dumbbells and bench": all available, curls above rows (MAP-02)', async () => {
    const test = createTestDeps();
    await onboarded(test, { preset: 'preset.dumbbells-bench', style: 'bodybuilding' });
    const ranked = await muscleExercises(test.deps, { muscle: 'mu.elbow-flexors' as MuscleId });
    expect(ranked.length).toBeGreaterThan(2);
    expect(ranked.every((entry) => entry.available)).toBe(true);
    const lastCurl = ranked.findLastIndex((entry) => entry.role === 'primary');
    const firstRow = ranked.findIndex((entry) => entry.role !== 'primary');
    expect(firstRow === -1 || lastCurl < firstRow).toBe(true);
    const withUnavailable = await muscleExercises(test.deps, {
      muscle: 'mu.elbow-flexors' as MuscleId,
      includeUnavailable: true,
    });
    const missing = withUnavailable.filter((entry) => !entry.available);
    expect(missing.length).toBeGreaterThan(0);
    expect(missing.every((entry) => entry.missing !== null)).toBe(true);
  });

  it('searches, filters, marks favourites and hidden exercises, shows the detail with setup memory', async () => {
    const test = createTestDeps();
    await onboarded(test);
    const found = await searchExercises(test.deps, { text: 'bench press' });
    expect(found[0]?.exerciseId).toBe(BENCH);
    await setFavourite(test.deps, { exerciseId: CURL, on: true });
    await setHidden(test.deps, { exerciseId: ROW, on: true });
    const curls = await searchExercises(test.deps, { muscles: ['mu.elbow-flexors' as MuscleId] });
    expect(curls.map((item) => item.exerciseId)).not.toContain(ROW);
    expect(curls.find((item) => item.exerciseId === CURL)?.favourite).toBe(true);
    const saved = await saveExerciseUserData(test.deps, {
      exerciseId: BENCH,
      setup: [
        { field: 'rack', value: 'Pins 4' },
        { field: 'other', label: 'Grip', value: 'Ring finger on the ring' },
      ],
      trainingMax: kg(110),
    });
    expect(saved.ok).toBe(true);
    const detail = await exerciseDetail(test.deps, BENCH);
    expect(detail?.userData?.setup).toHaveLength(2);
    expect(detail?.info.relations.lift).toBe('bench');
    expect(detail?.rest.value).toBeGreaterThan(0);
    const history = await exerciseHistory(test.deps, BENCH);
    expect(history?.trainingMax).toEqual(kg(110));
  });

  it('creates a custom exercise that counts like a built-in one, survives a restore and retires when used', async () => {
    const test = createTestDeps();
    await onboarded(test, { style: 'bodybuilding' });
    const draft = customExerciseDraft(test.deps, CURL);
    const saved = await saveCustomExercise(test.deps, {
      exercise: { ...draft.input!, name: 'Spider curl (my gym)', variantOf: undefined as never },
      copiedFrom: CURL,
    });
    if (!saved.ok) throw new Error(JSON.stringify(saved.error));
    const custom = saved.value;
    expect(test.deps.content.exercise(custom.id)?.custom).toBe(true);
    await logPast(test, 0, [{ exerciseId: custom.id, loads: [10, 10, 10] }]);
    const volume = await weeklyVolume(test.deps);
    expect(
      volume.rows.find((row) => row.muscle === ('mu.elbow-flexors' as MuscleId))!.fractional,
    ).toBe(3);
    // Backup and restore keep it (and the catalog knows it again).
    await exportBackup(test.deps);
    const preview = await previewImport(test.deps, test.savedFiles.at(-1)!.bytes);
    if (!preview.ok) throw new Error(preview.error.kind);
    expect(preview.value.tables.customExercises.map((entry) => entry.id)).toEqual([custom.id]);
    await applyImport(test.deps, preview.value);
    expect(test.deps.content.exercise(custom.id)?.name.en).toBe('Spider curl (my gym)');
    const removed = await deleteCustomExercise(test.deps, custom.id);
    expect(removed).toEqual({ ok: true, value: { outcome: 'retired' } });
    expect(test.deps.content.exercise(custom.id)?.status).toBe('deprecated');
    const invalid = await saveCustomExercise(test.deps, {
      exercise: { ...draft.input!, name: 'Dumbbell curl' },
    });
    expect(invalid.ok).toBe(false);
  });

  it('adds an exercise to today: the active session, else today’s planned session, else says there is none', async () => {
    const empty = createTestDeps();
    expect(await addExerciseToToday(empty.deps, CURL)).toEqual({
      ok: true,
      value: { kind: 'noSessionToday' },
    });
    const test = createTestDeps(undefined, { start: '2026-11-23T17:00:00Z' });
    await onboarded(test, { style: 'bodybuilding' });
    // Move to the day of the first planned session.
    const first = test
      .data()
      .plannedSessions.toSorted((a, b) => (a.localDate < b.localDate ? -1 : 1))[0]!;
    while (day(test, 0) < first.localDate) test.advanceDays(1);
    const planned = await addExerciseToToday(test.deps, CURL);
    expect(planned).toEqual({
      ok: true,
      value: { kind: 'addedToPlanned', plannedSessionId: first.id },
    });
    expect(
      test
        .data()
        .plannedSessions.find((session) => session.id === first.id)!
        .slots.at(-1)!.exerciseId,
    ).toBe(CURL);
    await startWorkout(test.deps, { source: { kind: 'freestyle', exerciseIds: [BENCH] } });
    const added = await addExerciseToToday(test.deps, CURL);
    expect(added.ok && added.value.kind).toBe('addedToSession');
  });

  it('offers plan placements the plan editor accepts (MAP-05 → PLN-09)', async () => {
    const test = createTestDeps();
    await onboarded(test, { style: 'bodybuilding' });
    const placements = await planPlacements(test.deps, {
      exerciseId: CURL,
      muscle: 'mu.elbow-flexors' as MuscleId,
    });
    expect(placements?.days.length).toBe(3);
    const preview = await previewPlanEdit(test.deps, {
      planId: placements!.planId,
      edits: [placements!.days[0]!.add],
    });
    expect(preview.ok).toBe(true);
  });

  it('shows the active session’s setup memory live (EXL-09)', async () => {
    const test = createTestDeps();
    await saveExerciseUserData(test.deps, {
      exerciseId: BENCH,
      setup: [{ field: 'seat', value: '4' }],
    });
    await startWorkout(test.deps, { source: { kind: 'freestyle', exerciseIds: [BENCH] } });
    const seen: number[] = [];
    const subscription = observeSessionSetups(test.deps).subscribe({
      next: (map) => seen.push(map.size),
    });
    await expect.poll(() => seen.at(-1)).toBe(1);
    subscription.unsubscribe();
  });
});

describe('live volume, the volume series and the performance data (ANL-02, ANL-03)', () => {
  it('re-emits the weekly volume after a logged session and gives the weekly series per muscle', async () => {
    const test = createTestDeps();
    const seen: number[] = [];
    const subscription = observeWeeklyVolume(test.deps).subscribe({
      next: (view) =>
        seen.push(
          view.rows.find((row) => row.muscle === ('mu.elbow-flexors' as MuscleId))!.fractional,
        ),
    });
    await expect.poll(() => seen.at(-1)).toBe(0);
    await logPast(test, 0, [{ exerciseId: CURL, loads: [12, 12, 12] }]);
    await expect.poll(() => seen.at(-1), { timeout: 5000 }).toBe(3);
    subscription.unsubscribe();
    await logPast(test, -7, [{ exerciseId: CURL, loads: [12, 12] }]);
    const history = await volumeHistory(test.deps, {
      from: day(test, -14),
      muscles: ['mu.elbow-flexors' as MuscleId],
    });
    expect(history.weeks).toHaveLength(3);
    expect(history.series[0]!.points.map((point) => point.fractional)).toEqual([0, 2, 3]);
  });

  it('compares up to three exercises as % change and gives best sets, volume load and reps at a load', async () => {
    const test = createTestDeps();
    for (let week = 3; week >= 0; week--) {
      await logPast(test, -7 * week, [
        { exerciseId: BENCH, loads: [80 + (3 - week) * 2.5], reps: 5, rir: 2 },
        { exerciseId: SQUAT, loads: [100], reps: 5, rir: 2 },
      ]);
    }
    const compared = await compareTrends(test.deps, { exerciseIds: [BENCH, SQUAT], source: 'all' });
    expect(compared.map((entry) => entry.points[0]!.pct)).toEqual([0, 0]);
    expect(compared[0]!.points.at(-1)!.pct).toBeGreaterThan(0);
    expect(compared[1]!.points.at(-1)!.pct).toBeCloseTo(0, 6);
    const performance = await exercisePerformance(test.deps, { exerciseId: BENCH });
    expect(performance.points.map((point) => point.topLoadKg)).toEqual([80, 82.5, 85, 87.5]);
    expect(performance.points.map((point) => point.volumeKg)).toEqual([400, 412.5, 425, 437.5]);
    const atLoad = await exercisePerformance(test.deps, { exerciseId: BENCH, loadKg: 85 });
    expect(atLoad.repsAtLoad?.points.map((point) => point.reps)).toEqual([5, 5]);
  });

  it('observes the bodyweight overview', async () => {
    const test = createTestDeps();
    const counts: number[] = [];
    const subscription = observeBodyweight(test.deps).subscribe({
      next: (view) => counts.push(view.entries.length),
    });
    await expect.poll(() => counts.at(-1)).toBe(0);
    await logBodyweight(test.deps, { mass: kg(80) });
    await expect.poll(() => counts.at(-1)).toBe(1);
    subscription.unsubscribe();
  });
});

describe('streak, trends, history, scores and the body (MOT, ANL, BOD)', () => {
  it('marks a break week at most four weeks back; the week pauses the streak; grace is a preference', async () => {
    const test = createTestDeps();
    await logPast(test, -14, [{ exerciseId: CURL, loads: [10, 10] }]);
    expect(
      await markWeekAsBreak(test.deps, { weekStart: day(test, -35), reason: 'vacation' }),
    ).toEqual({ ok: false, error: { kind: 'tooFarBack' } });
    const marked = await markWeekAsBreak(test.deps, {
      weekStart: day(test, -7),
      reason: 'illness',
    });
    expect(marked.ok).toBe(true);
    const view = await streakView(test.deps);
    expect(view.weeks.map((week) => week.state)).toContain('paused');
    expect(view.weeks[0]!.why.rule).toBe('streak.week');
    expect(view.current).toBe(1);
    await updateInsightPreferences(test.deps, { streakGrace: true, weeklySessionTarget: 2 });
    expect((await streakView(test.deps)).grace).toBe(true);
    // The session two weeks ago kept its week (the first of the streak).
    const change = await sessionStreakChange(test.deps, test.data().sessions[0]!.id);
    expect(change).toMatchObject({ kept: true, current: 1 });
  });

  it('reports the streak change a session made (celebration data)', async () => {
    const test = createTestDeps();
    const session = await logPast(test, 0, [{ exerciseId: CURL, loads: [10, 10] }]);
    expect(await sessionStreakChange(test.deps, session.session.id)).toEqual({
      kept: true,
      current: 1,
      best: 1,
      newBest: true,
    });
  });

  it('gives the e1RM trend, the rep-max table, the PR history, the calendar and the session list', async () => {
    const test = createTestDeps();
    for (let week = 6; week >= 0; week--) {
      await logPast(test, -7 * week, [
        {
          exerciseId: BENCH,
          loads: [80 + (6 - week) * 2.5, 80 + (6 - week) * 2.5],
          reps: 5,
          rir: 2,
        },
      ]);
    }
    const trend = await exerciseTrend(test.deps, { exerciseId: BENCH, range: '12w' });
    expect(trend.series.points.map((point) => point.localDate)).toEqual(
      [6, 5, 4, 3, 2, 1, 0].map((week) => day(test, -7 * week)),
    );
    expect(trend.series.points.at(-1)!.trend).not.toBeNull();
    expect(trend.pace).not.toBeNull();
    const history = await exerciseHistory(test.deps, BENCH);
    expect(history!.repMax[4]).toMatchObject({ loadKg: 95, setReps: 5, effortKnown: true });
    const prs = await prHistory(test.deps, { types: ['load'] });
    expect(prs[0]!.valueKg).toBe(95);
    const month = await trainingCalendar(test.deps, { month: day(test, 0).slice(0, 7) });
    expect(month.some((entry) => entry.states.includes('completed'))).toBe(true);
    const list = await sessionHistory(test.deps, { query: 'bench' });
    expect(list).toHaveLength(7);
    expect(await progressionAdvice(test.deps)).toEqual([]);
  });

  it('computes the scores from current e1RMs with the bodyweight trend, naming sources and versions', async () => {
    const test = createTestDeps();
    await onboarded(test);
    for (const [exerciseId, load] of [
      [SQUAT, 180],
      [BENCH, 120],
      [id('ex.barbell-deadlift'), 200],
    ] as const) {
      await logPast(test, -2, [{ exerciseId, loads: [load], reps: 3, rir: 1 }]);
      await logPast(test, -1, [{ exerciseId, loads: [load], reps: 3, rir: 1 }]);
    }
    const board = await scores(test.deps);
    expect(board).toMatchObject({
      available: true,
      division: 'classic',
      source: 'e1rm',
      bodyweightKg: 83,
    });
    const gl = board.formulas.find((formula) => formula.formula === 'ipfGl')!;
    expect(gl.total).toBeGreaterThan(0);
    expect(gl.sources.length).toBeGreaterThan(0);
    expect(board.rulesVersion).toBe(test.deps.rules.version);
    const tested = await scores(test.deps, { source: 'tested' });
    expect(tested.totalKg).toBe(500);
  });

  it('logs, edits and deletes bodyweights; the overview has the trend, rate and band; measurements per site', async () => {
    const test = createTestDeps();
    expect((await logBodyweight(test.deps, { mass: kg(500) })).ok).toBe(false);
    const first = await logBodyweight(test.deps, { mass: kg(80) });
    if (!first.ok) throw new Error('bodyweight');
    for (let n = 0; n < 20; n++) {
      test.advanceDays(1);
      await logBodyweight(test.deps, { mass: kg(80 - n * 0.08) });
    }
    const edited = await editBodyweight(test.deps, {
      id: first.value.id,
      mass: kg(80.2),
      note: 'Morning',
    });
    expect(edited.ok && edited.value.note).toBe('Morning');
    const overview = await bodyweightOverview(test.deps);
    expect(overview.entries).toHaveLength(21);
    expect(overview.rate.value?.pctPerWeek).toBeLessThan(0);
    expect(overview.band.value.phase).toBe('notTracking');
    expect((await deleteBodyweight(test.deps, first.value.id)).ok).toBe(true);
    expect((await logMeasurement(test.deps, { site: 'waist', value: 84, unit: 'cm' })).ok).toBe(
      true,
    );
    expect(
      (await logMeasurement(test.deps, { site: 'skinfoldThigh', value: 12, unit: 'cm' })).ok,
    ).toBe(false);
    const measurements = await measurementsOverview(test.deps);
    expect(measurements.series.find((series) => series.site === 'waist')!.latest!.value).toBe(84);
  });
});

/** Sessions that ended or were logged in a test, for the IDs used above. */
export type { SessionId };
