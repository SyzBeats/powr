import {
  SESSION_DEFAULTS,
  addDays,
  instantAt,
  makeInstantTz,
  toLocalDate,
  weekdayOf,
  type BodyweightEntry,
  type BreakId,
  type ExerciseId,
  type LocalDate,
  type LoggedSet,
  type PlannedSet,
  type Session,
  type SessionExercise,
  type SessionId,
  type SetId,
  type TrainingBreak,
} from '@powr/domain';
import { RAW_TABLE_NAMES, type RawTables } from '@powr/formats';

import type { Deps } from '../deps';
import { DERIVED_TABLE_NAMES } from '../ports';

/*
 * `@powr/application/reference` (M6a): the reference dataset of the performance budgets (PRD A-11,
 * technical concept §8.19): about five years of training, 1,300 workouts, 40,000 sets and 1,800
 * weigh-ins with a few breaks. M4a's generator (`test/perf.test.ts`), moved here so the browser
 * can load the same history into the real IndexedDB (the debug page `/debug/perf` and the opt-in
 * E2E perf spec) and the S22 can be measured with it. Deterministic: the same options give the
 * same records. Not on any product path: only the debug page imports it.
 */

/** Exercise IDs per training day (push, pull, legs, upper, lower), six per day. */
const DAYS = [
  [
    'ex.barbell-bench-press',
    'ex.barbell-overhead-press',
    'ex.incline-dumbbell-press',
    'ex.dumbbell-lateral-raise',
    'ex.cable-triceps-pressdown',
    'ex.cable-fly',
  ],
  [
    'ex.barbell-deadlift',
    'ex.lat-pulldown',
    'ex.seated-cable-row',
    'ex.one-arm-dumbbell-row',
    'ex.dumbbell-curl',
    'ex.hammer-curl',
  ],
  [
    'ex.barbell-back-squat',
    'ex.leg-press',
    'ex.barbell-romanian-deadlift',
    'ex.leg-extension',
    'ex.seated-leg-curl',
    'ex.standing-calf-raise',
  ],
  [
    'ex.barbell-bench-press',
    'ex.pull-up',
    'ex.barbell-overhead-press',
    'ex.cable-lateral-raise',
    'ex.overhead-cable-triceps-extension',
    'ex.dumbbell-curl',
  ],
  [
    'ex.barbell-back-squat',
    'ex.barbell-deadlift',
    'ex.barbell-hip-thrust',
    'ex.seated-leg-curl',
    'ex.leg-extension',
    'ex.standing-calf-raise',
  ],
] as const;

/** Starting loads (kg) per exercise; they rise slowly over the years. */
const BASE_KG: Readonly<Record<string, number>> = {
  'ex.barbell-bench-press': 70,
  'ex.barbell-overhead-press': 40,
  'ex.incline-dumbbell-press': 24,
  'ex.dumbbell-lateral-raise': 8,
  'ex.cable-triceps-pressdown': 25,
  'ex.cable-fly': 15,
  'ex.barbell-deadlift': 120,
  'ex.lat-pulldown': 55,
  'ex.seated-cable-row': 55,
  'ex.one-arm-dumbbell-row': 26,
  'ex.dumbbell-curl': 12,
  'ex.hammer-curl': 14,
  'ex.barbell-back-squat': 100,
  'ex.leg-press': 160,
  'ex.barbell-romanian-deadlift': 80,
  'ex.leg-extension': 45,
  'ex.seated-leg-curl': 40,
  'ex.standing-calf-raise': 60,
  'ex.pull-up': 0,
  'ex.cable-lateral-raise': 7.5,
  'ex.overhead-cable-triceps-extension': 20,
  'ex.barbell-hip-thrust': 100,
};

export interface ReferenceOptions {
  /** The last day of the history (sessions and weigh-ins end here). */
  readonly end: LocalDate;
  readonly zone: string;
  /** Weeks of history, breaks included (default 270: 260 training weeks and 10 on a break). */
  readonly weeks?: number;
  /** Training days per week (default 5; M4a's engine test uses 4). */
  readonly daysPerWeek?: 1 | 2 | 3 | 4 | 5;
  /** Working sets per exercise, cycled over the session's six exercises (default 6,5,5,5,5,5). */
  readonly setsPerExercise?: readonly number[];
  /** Daily weigh-ins over the last N days (default 1,800). */
  readonly weighIns?: number;
  /** Two-week breaks, evenly spread (default 5). */
  readonly breaks?: number;
  /** ID prefix, so a second load never collides with the first (default `ref`). */
  readonly prefix?: string;
}

export interface ReferenceHistory {
  readonly sessions: Session[];
  readonly sets: LoggedSet[];
  readonly bodyweights: BodyweightEntry[];
  readonly breaks: TrainingBreak[];
}

/** Weekday offsets of the training days in a Monday-based week. */
const OFFSETS: Readonly<Record<number, readonly number[]>> = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 1, 3, 4],
  5: [0, 1, 2, 3, 4],
};

/** The reference history (A-11) for `options`. Pure and deterministic. */
export function referenceHistory(options: ReferenceOptions): ReferenceHistory {
  const weeks = options.weeks ?? 270;
  const days = options.daysPerWeek ?? 5;
  const setsPerExercise = options.setsPerExercise ?? [6, 5, 5, 5, 5, 5];
  const prefix = options.prefix ?? 'ref';
  const breakCount = options.breaks ?? 5;
  const { zone } = options;
  // The last week is the one of `end` (its days after `end` stay empty).
  const lastMonday = addDays(options.end, 1 - weekdayOf(options.end));
  const start = addDays(lastMonday, -7 * (weeks - 1));

  const breakWeeks = new Set<number>();
  const breaks: TrainingBreak[] = [];
  for (let n = 0; n < breakCount; n++) {
    const week = Math.floor(((n + 0.5) * weeks) / Math.max(1, breakCount));
    breakWeeks.add(week);
    breakWeeks.add(week + 1);
    const startDate = addDays(start, week * 7);
    breaks.push({
      id: `${prefix}-break-${n}` as BreakId,
      startDate,
      endDate: addDays(startDate, 13),
      reason: n % 2 === 0 ? 'vacation' : 'life',
      createdAt: instantAt(startDate, '08:00', zone),
    });
  }

  const sessions: Session[] = [];
  const sets: LoggedSet[] = [];
  let trained = 0;
  for (let week = 0; week < weeks; week++) {
    if (breakWeeks.has(week)) continue;
    // A lighter week every fifth training week: fewer reps, same loads.
    const lighter = trained % 5 === 4;
    trained++;
    OFFSETS[days]!.forEach((offset, day) => {
      const localDate = addDays(start, week * 7 + offset);
      if (localDate > options.end) return;
      const started = instantAt(localDate, '17:30', zone).epochMs;
      const id = `${prefix}-s-${week}-${day}` as SessionId;
      // Logged workouts carry their exercises and planned sets (the session core, M3a).
      const slots: SessionExercise[] = DAYS[day % DAYS.length]!.map((exerciseId, order) => ({
        key: `x${order + 1}`,
        exerciseId: exerciseId as ExerciseId,
        origin: 'added',
        goal: 'hypertrophy',
        priority: order < 2 ? 'primary' : 'secondary',
        progression: 'doubleProgression',
        prescription: null,
        sets: Array.from(
          { length: setsPerExercise[order % setsPerExercise.length] ?? 5 },
          (_, n): PlannedSet => ({
            key: `s${n + 1}`,
            type: 'working',
            reps: [6, 12],
            rir: [1, 3],
            load: null,
          }),
        ),
        restSeconds: null,
        skipped: false,
      }));
      sessions.push({
        id,
        localDate,
        startedAt: makeInstantTz(started, zone),
        endedAt: makeInstantTz(started + 75 * 60_000, zone),
        status: 'finished',
        versions: { engine: 'reference', rules: 'reference', content: 'reference' },
        ...SESSION_DEFAULTS,
        exercises: slots,
      });
      let minute = 0;
      DAYS[day % DAYS.length]!.forEach((exerciseId, order) => {
        const base = BASE_KG[exerciseId] ?? 20;
        // About +25 % over five years, in 2.5 % steps of the base, with a small weekly wobble.
        const progress = base * (0.25 * (week / weeks));
        const count = setsPerExercise[order % setsPerExercise.length] ?? 5;
        for (let n = 0; n < count; n++) {
          const wobble = ((week + n + order) % 3) - 1;
          const kg = base === 0 ? 0 : Math.max(2.5, base + progress + wobble * 2.5);
          minute += 3;
          sets.push({
            id: `${id}-${order}-${n}` as SetId,
            sessionId: id,
            exerciseId: exerciseId as ExerciseId,
            index: n,
            type: 'working',
            load: base === 0 ? null : { value: Math.round(kg * 4) / 4, unit: 'kg' },
            reps: (lighter ? 4 : 6) + ((week + day + n) % 6),
            effort: { rir: lighter ? 4 : 1 + ((n + week) % 3), source: 'entered' },
            state: 'done',
            performedAt: makeInstantTz(started + minute * 60_000, zone),
            localDate,
            slotKey: `x${order + 1}`,
            setKey: `s${n + 1}`,
          });
        }
      });
    });
  }

  const bodyweights: BodyweightEntry[] = [];
  const weighIns = options.weighIns ?? 1800;
  for (let back = weighIns - 1; back >= 0; back--) {
    const localDate = addDays(options.end, -back);
    const day = weighIns - 1 - back;
    // A slow bulk and cut every year, with day-to-day noise of about ±0.6 kg.
    const trend = 80 + 3 * Math.sin((2 * Math.PI * day) / 365);
    const noise = (((day * 7919) % 13) - 6) / 10;
    bodyweights.push({
      id: `${prefix}-bw-${day}`,
      localDate,
      measuredAt: instantAt(localDate, '07:15', zone),
      mass: { value: Math.round((trend + noise) * 10) / 10, unit: 'kg' },
    });
  }

  return { sessions, sets, bodyweights, breaks };
}

export interface ReferenceLoad {
  readonly sessions: number;
  readonly sets: number;
  readonly bodyweights: number;
  readonly breaks: number;
}

/**
 * Adds the reference history to the data on this phone (the profile, plan and settings stay):
 * every raw table is read, the history appended, and the whole is written back through the
 * restore's replace-all transaction, which clears the derived tables (rebuilt on use, §8.2.8).
 * Earlier reference records with the same prefix are replaced, not doubled.
 */
export async function addReferenceHistory(
  deps: Deps,
  options: Omit<ReferenceOptions, 'end' | 'zone'> = {},
): Promise<ReferenceLoad> {
  const now = deps.clock.now();
  // Up to yesterday in the device zone: today stays free for a workout.
  const end = addDays(toLocalDate(now), -1);
  const history = referenceHistory({ ...options, end, zone: now.zone });
  const prefix = `${options.prefix ?? 'ref'}-`;
  const keep = <T extends { readonly id: string }>(rows: readonly T[]) =>
    rows.filter((row) => !row.id.startsWith(prefix));
  await deps.uow.write([...RAW_TABLE_NAMES, ...DERIVED_TABLE_NAMES], async (repos) => {
    const current: RawTables = await repos.raw.readAll();
    await repos.raw.replaceAll({
      ...current,
      sessions: [...keep(current.sessions), ...history.sessions],
      sets: [...keep(current.sets), ...history.sets],
      bodyweights: [...keep(current.bodyweights), ...history.bodyweights],
      breaks: [...keep(current.breaks), ...history.breaks],
    });
  });
  return {
    sessions: history.sessions.length,
    sets: history.sets.length,
    bodyweights: history.bodyweights.length,
    breaks: history.breaks.length,
  };
}
