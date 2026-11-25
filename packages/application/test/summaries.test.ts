import { describe, expect, it } from 'vitest';

import type { ExerciseId, LocalDate } from '@powr/domain';

import type { Deps, Repositories, TableName } from '../src';
import { exerciseHistory, exerciseSummaries, exerciseTrend } from '../src/insights';
import { logPastSession } from '../src/session';
import { createTestDeps } from './fakes';

/*
 * TD-55: the Progress hub's bulk summaries equal what the single-exercise screens show (ANL-02's
 * latest label, ANL-04's current e1RM and calibration), rebuild stale derived data like they do,
 * and read the same number of times however many exercises are listed.
 */

type Test = ReturnType<typeof createTestDeps>;
const id = (value: string) => value as ExerciseId;
const kg = (value: number) => ({ value, unit: 'kg' as const });
const BENCH = id('ex.barbell-bench-press');
const SQUAT = id('ex.barbell-back-squat');
const CURL = id('ex.dumbbell-curl');
const ROW = id('ex.one-arm-dumbbell-row');

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
        reps: entry.reps ?? 5,
        rir: entry.rir === undefined ? 2 : entry.rir,
      })),
    })),
  });
  if (!result.ok) throw new Error(JSON.stringify(result.error));
}

/** Eight weeks of bench (rising), squat twice, curls once without effort ratings. */
async function history(test: Test) {
  for (let week = 7; week >= 0; week--) {
    const load = 80 + (7 - week) * 2.5;
    await logPast(test, -7 * week, [
      { exerciseId: BENCH, loads: [load, load, load] },
      ...(week % 4 === 0 ? [{ exerciseId: SQUAT, loads: [120, 120] }] : []),
    ]);
  }
  await logPast(test, -2, [{ exerciseId: CURL, loads: [12, 12], reps: 10, rir: null }]);
}

/** Counts every repository call made through the unit of work, by `repo.method`. */
function countingDeps(deps: Deps) {
  const calls = new Map<string, number>();
  const wrap = (repos: Repositories): Repositories =>
    new Proxy(repos, {
      get(target, repoName: string) {
        const repo = (target as unknown as Record<string, Record<string, unknown>>)[repoName]!;
        return new Proxy(repo, {
          get(inner, method: string) {
            const value = inner[method];
            if (typeof value !== 'function') return value;
            return (...args: unknown[]) => {
              const key = `${repoName}.${method}`;
              calls.set(key, (calls.get(key) ?? 0) + 1);
              return (value as (...rest: unknown[]) => unknown).apply(inner, args);
            };
          },
        });
      },
    });
  const counted: Deps = {
    ...deps,
    uow: {
      read: <T>(tables: readonly TableName[], fn: (repos: Repositories) => Promise<T>) =>
        deps.uow.read(tables, (repos) => fn(wrap(repos))),
      write: <T>(tables: readonly TableName[], fn: (repos: Repositories) => Promise<T>) =>
        deps.uow.write(tables, (repos) => fn(wrap(repos))),
    },
  };
  return { deps: counted, calls };
}

describe('exercise summaries for the Progress hub (TD-55)', () => {
  it('lists trained exercises most trained first with the trend screens’ e1RM, calibration and label', async () => {
    const test = createTestDeps();
    await history(test);
    const summaries = await exerciseSummaries(test.deps);
    expect(summaries.map((entry) => entry.exerciseId)).toEqual([BENCH, SQUAT, CURL]);
    expect(summaries[0]).toMatchObject({ sessions: 8, lastDate: day(test, 0) });
    expect(summaries[1]).toMatchObject({ sessions: 2, lastDate: day(test, 0) });
    expect(summaries[2]).toMatchObject({ sessions: 1, lastDate: day(test, -2) });

    for (const summary of summaries) {
      const single = await exerciseHistory(test.deps, summary.exerciseId);
      const trend = await exerciseTrend(test.deps, { exerciseId: summary.exerciseId });
      const current = single!.e1rm.strengthKg ?? single!.e1rm.allKg;
      expect(summary.e1rm?.kg ?? null).toBe(current);
      expect(summary.e1rm?.lowKg ?? null).toBe(single!.e1rm.lowKg);
      expect(summary.e1rm?.highKg ?? null).toBe(single!.e1rm.highKg);
      const source =
        current === null ? null : single!.e1rm.strengthKg !== null ? 'strength' : 'all';
      expect(summary.e1rm?.source ?? null).toBe(source);
      expect(summary.calibration).toBe(single!.calibration);
      expect(summary.change).toEqual(trend.series.latest);
    }
    // Eight rising weeks of heavy bench: an estimate and a label the trend screen also gives.
    expect(summaries[0]!.e1rm).not.toBeNull();
    expect(summaries[0]!.change?.value.label).not.toBe('insufficientData');
  });

  it('limits the list to a window and to chosen exercises', async () => {
    const test = createTestDeps();
    await history(test);
    const recent = await exerciseSummaries(test.deps, { from: day(test, -6) });
    expect(recent.map((entry) => entry.exerciseId)).toEqual([BENCH, SQUAT, CURL]);
    expect(recent[0]!.sessions).toBe(1);
    const chosen = await exerciseSummaries(test.deps, { exerciseIds: [CURL, ROW] });
    expect(chosen.map((entry) => entry.exerciseId)).toEqual([CURL]);
    expect(await exerciseSummaries(createTestDeps().deps)).toEqual([]);
  });

  it('rebuilds stale derived data first, as the single-exercise screens do', async () => {
    const test = createTestDeps();
    await history(test);
    const before = await exerciseSummaries(test.deps);
    await test.deps.uow.write(['dExerciseState', 'dSessionE1rm', 'dPrs'], (repos) =>
      repos.derived.clear(),
    );
    expect(test.data().dExerciseState).toHaveLength(0);
    expect(await exerciseSummaries(test.deps)).toEqual(before);
  });

  it('reads in bulk: the same reads for one or four exercises, never one query per row', async () => {
    const one = createTestDeps();
    await logPast(one, -1, [{ exerciseId: BENCH, loads: [80, 80] }]);
    await exerciseSummaries(one.deps);
    const few = countingDeps(one.deps);
    await exerciseSummaries(few.deps);

    const four = createTestDeps();
    for (let week = 3; week >= 0; week--) {
      await logPast(four, -7 * week - 1, [
        { exerciseId: BENCH, loads: [80, 80] },
        { exerciseId: SQUAT, loads: [120, 120] },
        { exerciseId: CURL, loads: [12, 12], reps: 10 },
        { exerciseId: ROW, loads: [30, 30], reps: 10 },
      ]);
    }
    await exerciseSummaries(four.deps);
    const many = countingDeps(four.deps);
    expect(await exerciseSummaries(many.deps)).toHaveLength(4);

    const perRow = [
      'sets.bySession',
      'sets.byExercise',
      'derived.pointsByExercise',
      'derived.prsByExercise',
      'derived.prsBySession',
    ];
    for (const key of perRow) {
      expect(few.calls.get(key) ?? 0).toBe(0);
      expect(many.calls.get(key) ?? 0).toBe(0);
    }
    expect(Object.fromEntries(many.calls)).toEqual(Object.fromEntries(few.calls));
    expect(many.calls.get('derived.exerciseStates')).toBe(2);
    expect(many.calls.get('derived.pointsInRange')).toBe(1);
  });
});
