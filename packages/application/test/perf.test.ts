import { describe, expect, it } from 'vitest';

import { builtInContent } from '@powr/content/built-in';
import {
  SESSION_DEFAULTS,
  addDays,
  makeInstantTz,
  weekStartOf,
  type ExerciseId,
  type LocalDate,
  type LoggedSet,
  type Session,
  type SessionId,
  type SetId,
} from '@powr/domain';
import { buildWeek, e1rmSeries, volumeRows } from '@powr/domain/analytics';
import { emptyExerciseState, exposuresOf, rebuildExerciseState } from '@powr/domain/session';
import { computeStreak } from '@powr/domain/streaks';
import { emptyRawTables } from '@powr/formats';

import { ensureInsights, exerciseTrend, homeView, weeklyVolume } from '../src/insights';
import { ensureDerived } from '../src/session';
import { prepare } from '../src/session/context';
import { createTestDeps, testRules } from './fakes';

/** Test environment (no Node types in this project). */
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/*
 * Performance (NFR-PERF-06, §8.2.8): the derived data of a five-year synthetic history (4 sessions
 * a week, 6 exercises × 6 working sets: 1,040 sessions, 37,440 sets, the concept's reference size)
 * built from scratch, and the queries Home and the insight screens make. Timings are printed with
 * POWR_PERF=1 (`POWR_PERF=1 pnpm vitest run --project application test/perf.test.ts`); the budgets
 * here are loose ceilings for CI machines, the S22 measurement is a device-test item.
 */

const DAYS = [
  [
    'ex.barbell-back-squat',
    'ex.barbell-bench-press',
    'ex.seated-cable-row',
    'ex.dumbbell-lateral-raise',
    'ex.dumbbell-curl',
    'ex.cable-triceps-pressdown',
  ],
  [
    'ex.barbell-deadlift',
    'ex.barbell-overhead-press',
    'ex.lat-pulldown',
    'ex.leg-extension',
    'ex.seated-leg-curl',
    'ex.standing-calf-raise',
  ],
  [
    'ex.barbell-back-squat',
    'ex.incline-dumbbell-press',
    'ex.one-arm-dumbbell-row',
    'ex.cable-lateral-raise',
    'ex.hammer-curl',
    'ex.overhead-cable-triceps-extension',
  ],
  [
    'ex.barbell-romanian-deadlift',
    'ex.barbell-bench-press',
    'ex.pull-up',
    'ex.leg-press',
    'ex.cable-fly',
    'ex.barbell-hip-thrust',
  ],
] as const;
const WEEKS = 260;
const TODAY = '2026-11-23' as LocalDate;
const START = addDays(TODAY, -7 * WEEKS);
const ZONE = 'Europe/Zurich';

function synthetic() {
  const tables = emptyRawTables();
  let setCount = 0;
  for (let week = 0; week < WEEKS; week++) {
    for (let day = 0; day < 4; day++) {
      const localDate = addDays(START, week * 7 + [0, 1, 3, 4][day]!);
      const started = Date.parse(`${localDate}T17:00:00Z`);
      const id = `s-${week}-${day}` as SessionId;
      const session: Session = {
        id,
        localDate,
        startedAt: makeInstantTz(started, ZONE),
        endedAt: makeInstantTz(started + 75 * 60_000, ZONE),
        status: 'finished',
        versions: { engine: 'perf', rules: 'perf', content: 'perf' },
        ...SESSION_DEFAULTS,
      };
      tables.sessions.push(session);
      DAYS[day]!.forEach((exerciseId, order) => {
        const base = 40 + order * 10 + week * 0.15;
        for (let n = 0; n < 6; n++) {
          const set: LoggedSet = {
            id: `${id}-${order}-${n}` as SetId,
            sessionId: id,
            exerciseId: exerciseId as ExerciseId,
            index: n,
            type: 'working',
            load: { value: Math.round((base + ((week + n) % 3) * 2.5) * 4) / 4, unit: 'kg' },
            reps: 5 + ((week + day + n) % 6),
            effort: { rir: 1 + ((n + week) % 3), source: 'entered' },
            state: 'done',
            performedAt: makeInstantTz(started + (order * 6 + n) * 180_000, ZONE),
            localDate,
          };
          tables.sets.push(set);
          setCount++;
        }
      });
    }
  }
  return { tables, setCount };
}

const report = (label: string, ms: number) => {
  if (env['POWR_PERF']) console.warn(`[perf] ${label}: ${ms.toFixed(0)} ms`);
};

async function timed<T>(
  label: string,
  run: () => Promise<T> | T,
): Promise<{ value: T; ms: number }> {
  const started = performance.now();
  const value = await run();
  const ms = performance.now() - started;
  report(label, ms);
  return { value, ms };
}

describe('five-year history (NFR-PERF-06)', () => {
  const { tables, setCount } = synthetic();

  it('builds every derived table of 1,040 sessions and 37,440 sets from scratch (pure engine)', async () => {
    expect(tables.sessions).toHaveLength(1040);
    expect(setCount).toBe(37_440);
    const content = builtInContent();
    const resolved = (await testRules.resolve({ style: 'powerbuilding', level: 'intermediate' }))
      .rules;
    const exerciseIds = [...new Set(tables.sets.map((set) => set.exerciseId))];
    const sessionRefs = tables.sessions.map((session) => ({
      id: session.id,
      localDate: session.localDate,
    }));
    const bySession = new Map<SessionId, LoggedSet[]>();
    for (const set of tables.sets)
      bySession.set(set.sessionId, [...(bySession.get(set.sessionId) ?? []), set]);

    const states = await timed('dExerciseState + dSessionE1rm + dPrs, all exercises', () =>
      exerciseIds.map((exerciseId) =>
        rebuildExerciseState(
          emptyExerciseState(exerciseId, 'k'),
          exposuresOf(
            tables.sets.filter((set) => set.exerciseId === exerciseId),
            sessionRefs,
          ),
          {
            exercise: content.exercise(exerciseId)!,
            rules: resolved,
            level: 'intermediate',
            bodyweightAt: () => 80,
          },
        ),
      ),
    );
    const weekly = await timed('dWeekly, 260 weeks', () => {
      const weeks = new Map<LocalDate, Session[]>();
      for (const session of tables.sessions) {
        const week = weekStartOf(session.localDate, 1);
        weeks.set(week, [...(weeks.get(week) ?? []), session]);
      }
      return [...weeks].map(([weekStart, sessions]) =>
        buildWeek(
          {
            weekStart,
            key: 'k',
            sessions: sessions.map((session) => ({
              session,
              sets: bySession.get(session.id) ?? [],
            })),
            planned: [],
            breaks: [],
            targets: null,
          },
          { exercise: (id) => content.exercise(id), rules: () => resolved },
        ),
      );
    });
    const streak = await timed('dStreak', () =>
      computeStreak(
        {
          weeks: weekly.value.map((record) => ({
            weekStart: record.weekStart,
            done: record.sessions.counting,
            planned: 0,
            onBreak: 0,
            deload: false,
            breakDays: 0,
          })),
          currentWeek: TODAY,
          firstActivity: START,
          weeklyTarget: 4,
          grace: false,
          weekStartsOn: 1,
        },
        resolved,
      ),
    );
    const squat = states.value[0]!;
    const series = await timed(
      'e1RM series of the most trained lift, all history (weekly maxima)',
      () =>
        e1rmSeries(
          {
            exerciseId: exerciseIds[0]!,
            points: squat.points,
            prs: squat.prs,
            source: 'all',
            from: null,
            to: TODAY,
            level: 'intermediate',
            weekStartsOn: 1,
          },
          resolved,
        ),
    );
    const rows = await timed('volume rows of one week', () =>
      volumeRows(
        {
          record: weekly.value.at(-1)!,
          groups: content.muscles().groups,
          exercise: (id) => content.exercise(id),
          openPlanned: [],
        },
        resolved,
      ),
    );
    expect(weekly.value).toHaveLength(WEEKS);
    expect(streak.value.value.current).toBe(WEEKS);
    expect(series.value.aggregated).toBe(true);
    expect(rows.value).toHaveLength(19);
    // Loose ceilings (a CI runner); the dev machine takes a fraction (see IMPLEMENTATION_NOTES).
    expect(states.ms + weekly.ms + streak.ms).toBeLessThan(20_000);
    expect(rows.ms).toBeLessThan(200);
  }, 120_000);

  it('rebuilds through the application and answers Home and the insight screens from derived data', async () => {
    const test = createTestDeps(tables, { start: `${TODAY}T17:00:00Z` });
    const ids = [...new Set(tables.sets.map((set) => set.exerciseId))];
    const prepared = await prepare(test.deps);
    const derived = await timed('application: ensureDerived (all exercises, in-memory fake)', () =>
      ensureDerived(test.deps, prepared, ids),
    );
    const insights = await timed('application: ensureInsights, full history (in-memory fake)', () =>
      ensureInsights(test.deps),
    );
    expect(insights.value.rebuiltWeeks).toBe(WEEKS);
    const again = await timed('application: ensureInsights when fresh', () =>
      ensureInsights(test.deps),
    );
    expect(again.value).toEqual({ rebuiltWeeks: 0, removedWeeks: 0, streak: false });
    const home = await timed('application: Home view (in-memory fake)', () => homeView(test.deps));
    expect(home.value.refreshing).toBe(false);
    expect(home.value.streak?.current).toBeGreaterThan(200);
    const volume = await timed('application: weekly volume', () => weeklyVolume(test.deps));
    expect(volume.value.rows).toHaveLength(19);
    const trend = await timed('application: squat trend, all history', () =>
      exerciseTrend(test.deps, {
        exerciseId: 'ex.barbell-back-squat' as ExerciseId,
        range: 'all',
        source: 'all',
      }),
    );
    expect(trend.value.series.aggregated).toBe(true);
    expect(derived.ms + insights.ms).toBeLessThan(60_000);
    expect(home.ms).toBeLessThan(5_000);
  }, 180_000);
});
