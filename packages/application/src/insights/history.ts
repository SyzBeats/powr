import { addDays, type ExerciseId, type LocalDate, type Mass, type Session } from '@powr/domain';
import {
  calendarDays,
  filterSessions,
  prHistory as filterPrs,
  repMaxTable,
  type CalendarDay,
  type ExposureSets,
  type PrFilter,
  type RepMaxRow,
  type SessionFilter,
  type SessionListItem,
} from '@powr/domain/analytics';
import {
  calibrationStatus,
  type CalibrationStatus,
  type ExerciseBests,
  type PrRecord,
} from '@powr/domain/session';

import type { Deps } from '../deps';
import { sessionExerciseIds } from '../ports';
import { ALL_FROM, ALL_TO, insightsContext } from './context';
import { loadExercise, sessionsOf } from './trends';

/*
 * History (ANL-04, ANL-05, ANL-06): an exercise's sessions with their sets, its rep-max table,
 * bests, current e1RM and training max; the PR history by type, exercise and date (each PR names
 * its session); the training calendar (completed, partial, missed, planned, deload and break days)
 * and the session list with search and filters.
 */

export interface ExerciseHistoryView {
  readonly exerciseId: ExerciseId;
  /** Every session with the exercise, newest first, with its sets in order. */
  readonly sessions: readonly ExposureSets[];
  /** ANL-04: best load for 1…12+ reps, with date, effort flags and e1RM. */
  readonly repMax: readonly RepMaxRow[];
  readonly bests: ExerciseBests | null;
  /** The current e1RM: strength trend, else all sets (PRG-02). */
  readonly e1rm: {
    readonly strengthKg: number | null;
    readonly allKg: number | null;
    readonly lowKg: number | null;
    readonly highKg: number | null;
  };
  readonly calibration: CalibrationStatus;
  /** The user-set training max (ANL-04), if any. */
  readonly trainingMax: Mass | null;
  readonly prs: readonly PrRecord[];
}

/** ANL-04: an exercise's history. */
export async function exerciseHistory(
  deps: Deps,
  exerciseId: ExerciseId,
): Promise<ExerciseHistoryView | null> {
  const exercise = deps.content.exercise(exerciseId);
  if (!exercise) return null;
  const ctx = await insightsContext(deps);
  const loaded = await loadExercise(deps, ctx, exerciseId);
  const userData = await deps.uow.read(['exerciseUserData'], (repos) =>
    repos.exerciseUserData.get(exerciseId),
  );
  const rules = ctx.prepared.rules(exerciseId);
  const counted = new Set(
    loaded.sessions
      .filter((session) => session.status === 'finished' || session.status === 'partial')
      .map((session) => session.id),
  );
  const state = loaded.state;
  return {
    exerciseId,
    sessions: sessionsOf(loaded.sets, loaded.sessions),
    repMax: repMaxTable(
      loaded.sets.filter((set) => counted.has(set.sessionId)),
      exercise,
      rules,
      ctx.prepared.bodyweightAt,
    ),
    bests: state?.bests ?? null,
    e1rm: {
      strengthKg: state?.strength?.e1rmKg ?? null,
      allKg: state?.all?.e1rmKg ?? null,
      lowKg: (state?.strength ?? state?.all)?.lowKg ?? null,
      highKg: (state?.strength ?? state?.all)?.highKg ?? null,
    },
    calibration: calibrationStatus(state, rules),
    trainingMax: userData?.trainingMax ?? null,
    prs: filterPrs(loaded.prs),
  };
}

/** ANL-05: PRs newest first, filtered by type, exercise and date range. */
export async function prHistory(deps: Deps, filter: PrFilter = {}): Promise<readonly PrRecord[]> {
  const prs = await deps.uow.read(['dPrs'], (repos) =>
    repos.derived.prsInRange(filter.from ?? ALL_FROM, filter.to ?? ALL_TO),
  );
  return filterPrs(prs, filter);
}

/** ANL-06: the calendar days of a month ('YYYY-MM') or a date range. */
export async function trainingCalendar(
  deps: Deps,
  input: { readonly month: string } | { readonly from: LocalDate; readonly to: LocalDate },
): Promise<readonly CalendarDay[]> {
  const ctx = await insightsContext(deps);
  const [from, to] = 'month' in input ? monthRange(input.month) : ([input.from, input.to] as const);
  const loaded = await deps.uow.read(['sessions', 'plannedSessions', 'breaks'], async (repos) => ({
    sessions: await repos.sessions.inRange(from, to),
    planned: await repos.plannedSessions.inRange(from, to),
    breaks: await repos.breaks.list(),
  }));
  return calendarDays({ from, to, today: ctx.today, ...loaded });
}

function monthRange(month: string): readonly [LocalDate, LocalDate] {
  const first = `${month}-01` as LocalDate;
  const next = addDays(first, 32).slice(0, 7);
  return [first, addDays(`${next}-01` as LocalDate, -1)];
}

/** ANL-06: the session list (finished and partial sessions) with search and filters. */
export async function sessionHistory(
  deps: Deps,
  filter: SessionFilter = {},
): Promise<readonly SessionListItem[]> {
  const loaded = await deps.uow.read(['sessions', 'sets', 'dPrs'], async (repos) => {
    const sessions = (
      await repos.sessions.inRange(filter.from ?? ALL_FROM, filter.to ?? ALL_TO)
    ).filter((session) => session.status === 'finished' || session.status === 'partial');
    const items: SessionListItem[] = [];
    for (const session of sessions) {
      const sets = await repos.sets.bySession(session.id);
      items.push(listItem(session, sets, (await repos.derived.prsBySession(session.id)).length));
    }
    return items;
  });
  return filterSessions(loaded, filter, (id) => deps.content.exercise(id)?.name.en ?? null);
}

function listItem(
  session: Session,
  sets: Parameters<typeof sessionExerciseIds>[1],
  prs: number,
): SessionListItem {
  return {
    session: {
      id: session.id,
      localDate: session.localDate,
      status: session.status,
      origin: session.origin,
      startedAt: session.startedAt,
      ...(session.endedAt ? { endedAt: session.endedAt } : {}),
      ...(session.note ? { note: session.note } : {}),
    },
    exerciseIds: sessionExerciseIds(session, sets),
    doneSets: sets.filter((set) => set.state === 'done').length,
    prs,
  };
}
