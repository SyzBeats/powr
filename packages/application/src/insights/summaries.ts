import {
  addDays,
  type ExerciseId,
  type LocalDate,
  type LoggedSet,
  type SessionId,
} from '@powr/domain';
import { e1rmSeries } from '@powr/domain/analytics';
import type { Explained } from '@powr/domain/explain';
import {
  calibrationStatus,
  type CalibrationStatus,
  type SessionE1rmPoint,
} from '@powr/domain/session';
import type { ChangeLabel } from '@powr/domain/trend';

import type { Deps } from '../deps';
import { sessionExerciseIds } from '../ports';
import { ensureDerived } from '../session/derived';
import { ALL_FROM, ALL_TO, insightsContext } from './context';

/*
 * TD-55: the Progress hub's list of trained exercises, each with its current e1RM and the strength
 * trend's latest change label, in one bulk pass. The reads do not grow with the number of rows:
 * two range reads for the list (sessions, sets), one `ensureDerived` over every listed exercise
 * (stale states rebuilt as the single-exercise screens do), then one read of the states and one
 * range read of the e1RM points. The values are the ones ANL-02 and ANL-04 show for the same
 * exercise: the current e1RM as `exerciseHistory` reports it and the label `exerciseTrend` gives as
 * `series.latest` (the domain's own `e1rmSeries`, so nothing is re-derived here).
 */

/** How far back the hub lists exercises by default (its "last 12 months"). */
const DEFAULT_DAYS = 365;

export interface ExerciseSummary {
  readonly exerciseId: ExerciseId;
  /** Finished and partial sessions with the exercise since `from`. */
  readonly sessions: number;
  /** The last of those sessions' days. */
  readonly lastDate: LocalDate;
  /**
   * The current e1RM (ANL-04, PRG-02): the strength trend, else the all-sets trend, with its 95%
   * range; null while no set with an effort rating gave an estimate.
   */
  readonly e1rm: {
    readonly kg: number;
    readonly lowKg: number;
    readonly highKg: number;
    readonly source: 'strength' | 'all';
  } | null;
  /** PRG-08: whether the estimate still calibrates to the user's effort ratings. */
  readonly calibration: CalibrationStatus;
  /** The strength trend's latest change label with its "Why?"; null without a strength trend. */
  readonly change: Explained<ChangeLabel> | null;
}

export interface SummaryQuery {
  /** First day of the window (default: 365 days before today). */
  readonly from?: LocalDate;
  /** Only these exercises (still only those trained in the window). */
  readonly exerciseIds?: readonly ExerciseId[];
}

/** TD-55: the trained exercises since `from`, most trained first, with e1RM and change label. */
export async function exerciseSummaries(
  deps: Deps,
  query: SummaryQuery = {},
): Promise<readonly ExerciseSummary[]> {
  const ctx = await insightsContext(deps);
  const from = query.from ?? addDays(ctx.today, -DEFAULT_DAYS);
  // M6a: a logged workout lists its exercises (the session core, past workouts and their edits
  // add a slot for every exercise with sets; a set's exercise is its slot's), so only sessions
  // without slots (M0 quick logs, old imports) and those with a swapped slot (sets logged before
  // a swap name the earlier exercise) need their sets read; a year of sets no longer is.
  const raw = await deps.uow.read(['sessions', 'sets'], async (repos) => {
    const sessions = (await repos.sessions.inRange(from, ALL_TO)).filter(
      (session) => session.status === 'finished' || session.status === 'partial',
    );
    const setsBySession = new Map<SessionId, readonly LoggedSet[]>();
    for (const session of sessions)
      if (
        session.exercises.length === 0 ||
        session.exercises.some((slot) => slot.substitutedFrom !== undefined)
      )
        setsBySession.set(session.id, await repos.sets.bySession(session.id));
    return { sessions, setsBySession };
  });
  const { setsBySession } = raw;
  const only = query.exerciseIds ? new Set(query.exerciseIds) : null;
  const trained = new Map<ExerciseId, { sessions: number; lastDate: LocalDate }>();
  for (const session of raw.sessions) {
    for (const exerciseId of sessionExerciseIds(session, setsBySession.get(session.id) ?? [])) {
      if (only && !only.has(exerciseId)) continue;
      const entry = trained.get(exerciseId) ?? { sessions: 0, lastDate: session.localDate };
      entry.sessions += 1;
      if (session.localDate > entry.lastDate) entry.lastDate = session.localDate;
      trained.set(exerciseId, entry);
    }
  }
  const ids = [...trained.keys()];
  if (ids.length === 0) return [];

  await ensureDerived(deps, ctx.prepared, ids);
  const derived = await deps.uow.read(['dExerciseState', 'dSessionE1rm'], async (repos) => ({
    states: await repos.derived.exerciseStates(ids),
    points: await repos.derived.pointsInRange(ALL_FROM, ALL_TO),
  }));
  const stateOf = new Map(derived.states.map((state) => [state.exerciseId, state]));
  const pointsOf = new Map<ExerciseId, SessionE1rmPoint[]>();
  for (const point of derived.points) {
    if (!trained.has(point.exerciseId)) continue;
    const list = pointsOf.get(point.exerciseId) ?? [];
    list.push(point);
    pointsOf.set(point.exerciseId, list);
  }

  return [...trained]
    .map(([exerciseId, entry]): ExerciseSummary => {
      const state = stateOf.get(exerciseId) ?? null;
      const rules = ctx.prepared.rules(exerciseId);
      const trend = state?.strength ?? state?.all ?? null;
      const points = pointsOf.get(exerciseId) ?? [];
      const latest =
        points.length === 0
          ? null
          : e1rmSeries(
              {
                exerciseId,
                points,
                prs: [],
                source: 'strength',
                from: ctx.today,
                to: ctx.today,
                level: ctx.prepared.level,
                weekStartsOn: ctx.weekStartsOn,
              },
              rules,
            ).latest;
      return {
        exerciseId,
        sessions: entry.sessions,
        lastDate: entry.lastDate,
        e1rm: trend
          ? {
              kg: trend.e1rmKg,
              lowKg: trend.lowKg,
              highKg: trend.highKg,
              source: state?.strength ? 'strength' : 'all',
            }
          : null,
        calibration: calibrationStatus(state, rules),
        change: latest,
      };
    })
    .toSorted(
      (a, b) =>
        b.sessions - a.sessions || (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0),
    );
}
