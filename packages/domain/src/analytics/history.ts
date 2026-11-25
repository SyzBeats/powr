/**
 * History (ANL-04, ANL-05, ANL-06): the rep-max table of an exercise (the heaviest load lifted for
 * at least n reps, n = 1…12, the same n-rep max the PRs use, with its date, the set's own reps,
 * the entered effort and the set's e1RM), the PR history (MOT-01 types by date, filterable) and
 * the training calendar (completed, partial, missed, planned, deload and break days) with the
 * session list's search and filters.
 */
import { estimateSetE1rm, type E1rmRules } from '../e1rm';
import type { ExerciseId, LocalDate, SessionId, SetId } from '../ids';
import type { ExerciseDef, LoggedSet, PlannedSession, Session, TrainingBreak } from '../model';
import { prCandidate, type PrRecord, type PrType } from '../session/prs';
import { addDays } from '../time';

/** ANL-04 rows: 1…12 reps; row 12 is "12 or more". */
export const REP_MAX_ROWS = 12;

export interface RepMaxRow {
  /** At least this many reps. */
  readonly reps: number;
  readonly loadKg: number | null;
  /** The set that holds it (the earliest of equal loads). */
  readonly setId: SetId | null;
  readonly sessionId: SessionId | null;
  readonly localDate: LocalDate | null;
  /** The set's own reps (≥ `reps`). */
  readonly setReps: number | null;
  /** Effort flags: the entered RIR, or none (MOT-01: no e1RM PR without effort). */
  readonly rir: number | null;
  readonly effortKnown: boolean;
  /** The set's e1RM; with unknown effort an estimate from the prior RIR (E-1). */
  readonly e1rmKg: number | null;
}

/**
 * ANL-04: best load for 1…12+ reps from an exercise's sets (done working sets that can set a PR:
 * no warm-ups, timed, assisted or band sets). A heavier set with more reps also holds the lower
 * rows, exactly as the rep PRs count them.
 */
export function repMaxTable(
  sets: readonly LoggedSet[],
  exercise: Pick<ExerciseDef, 'load'>,
  rules: E1rmRules,
  bodyweightAt: (date: LocalDate) => number | null = () => null,
): RepMaxRow[] {
  const candidates = sets
    .flatMap((set) => {
      const candidate = prCandidate(set, exercise);
      return candidate ? [{ set, ...candidate }] : [];
    })
    .toSorted(
      (a, b) =>
        a.set.performedAt.epochMs - b.set.performedAt.epochMs ||
        (a.set.id < b.set.id ? -1 : a.set.id > b.set.id ? 1 : 0),
    );
  return Array.from({ length: REP_MAX_ROWS }, (_, index) => {
    const reps = index + 1;
    let best: (typeof candidates)[number] | null = null;
    for (const candidate of candidates) {
      if (candidate.reps < reps) continue;
      if (best === null || candidate.loadKg > best.loadKg + 1e-9) best = candidate;
    }
    if (!best) {
      return {
        reps,
        loadKg: null,
        setId: null,
        sessionId: null,
        localDate: null,
        setReps: null,
        rir: null,
        effortKnown: false,
        e1rmKg: null,
      };
    }
    const effortKnown = best.set.effort.source === 'entered' && best.set.effort.rir !== null;
    const estimate = estimateSetE1rm(
      best.set,
      { ...exercise.load },
      { setOrder: 0, bodyweightKg: bodyweightAt(best.set.localDate) },
      rules,
    ).value;
    return {
      reps,
      loadKg: best.loadKg,
      setId: best.set.id,
      sessionId: best.set.sessionId,
      localDate: best.set.localDate,
      setReps: best.reps,
      rir: effortKnown ? best.set.effort.rir : null,
      effortKnown,
      e1rmKg: estimate?.e1rmKg ?? null,
    };
  });
}

export interface PrFilter {
  readonly types?: readonly PrType[];
  readonly exerciseIds?: readonly ExerciseId[];
  readonly from?: LocalDate;
  readonly to?: LocalDate;
}

/** ANL-05: PRs newest first, filtered by type, exercise and date range (AND across filters). */
export function prHistory(prs: readonly PrRecord[], filter: PrFilter = {}): PrRecord[] {
  return prs
    .filter(
      (pr) =>
        (!filter.types || filter.types.includes(pr.type)) &&
        (!filter.exerciseIds || filter.exerciseIds.includes(pr.exerciseId)) &&
        (filter.from === undefined || pr.localDate >= filter.from) &&
        (filter.to === undefined || pr.localDate <= filter.to),
    )
    .toSorted(
      (a, b) =>
        (a.localDate < b.localDate ? 1 : a.localDate > b.localDate ? -1 : 0) ||
        (a.id < b.id ? 1 : a.id > b.id ? -1 : 0),
    );
}

// --- Calendar (ANL-06) ---------------------------------------------------------------------

export const DAY_STATES = ['completed', 'partial', 'missed', 'planned', 'deload', 'break'] as const;
export type DayState = (typeof DAY_STATES)[number];

export interface CalendarDay {
  readonly date: LocalDate;
  readonly states: readonly DayState[];
  readonly sessions: readonly { readonly id: SessionId; readonly status: Session['status'] }[];
  readonly planned: readonly {
    readonly id: PlannedSession['id'];
    readonly status: PlannedSession['status'];
    readonly kind: PlannedSession['kind'];
  }[];
}

export interface CalendarInput {
  readonly from: LocalDate;
  readonly to: LocalDate;
  readonly today: LocalDate;
  readonly sessions: readonly Pick<
    Session,
    'id' | 'localDate' | 'status' | 'plannedAdjustments' | 'plannedSessionId'
  >[];
  readonly planned: readonly Pick<PlannedSession, 'id' | 'localDate' | 'status' | 'kind'>[];
  readonly breaks: readonly Pick<TrainingBreak, 'startDate' | 'endDate'>[];
}

/**
 * ANL-06: every day from `from` to `to` with its states. Completed and partial come from logged
 * sessions; a planned session is "missed" when its day has passed and it was neither done nor
 * merged (outside breaks, PLN-12), "planned" from today on; deload days carry a deload session;
 * break days fall inside a break.
 */
export function calendarDays(input: CalendarInput): CalendarDay[] {
  const sessionsByDay = groupBy(
    input.sessions.filter(
      (session) => session.status === 'finished' || session.status === 'partial',
    ),
    (session) => session.localDate,
  );
  const plannedByDay = groupBy(input.planned, (session) => session.localDate);
  const days: CalendarDay[] = [];
  for (let date = input.from; date <= input.to; date = addDays(date, 1)) {
    const sessions = sessionsByDay.get(date) ?? [];
    const planned = plannedByDay.get(date) ?? [];
    const onBreak = input.breaks.some(
      (entry) => date >= entry.startDate && (entry.endDate === null || date <= entry.endDate),
    );
    const states = new Set<DayState>();
    if (sessions.some((session) => session.status === 'finished')) states.add('completed');
    if (sessions.some((session) => session.status === 'partial')) states.add('partial');
    for (const entry of planned) {
      if (entry.status === 'planned' || entry.status === 'skipped') {
        if (date < input.today && !onBreak) states.add('missed');
        else if (date >= input.today && entry.status === 'planned' && !onBreak)
          states.add('planned');
      }
      if (entry.kind === 'deload' && entry.status !== 'merged') states.add('deload');
    }
    if (sessions.some((session) => session.plannedAdjustments?.includes('deload'))) {
      states.add('deload');
    }
    if (onBreak) states.add('break');
    days.push({
      date,
      states: DAY_STATES.filter((state) => states.has(state)),
      sessions: sessions.map((session) => ({ id: session.id, status: session.status })),
      planned: planned.map((entry) => ({ id: entry.id, status: entry.status, kind: entry.kind })),
    });
  }
  return days;
}

// --- Session list (ANL-06 "search and filters") ---------------------------------------------

export interface SessionListItem {
  readonly session: Pick<
    Session,
    'id' | 'localDate' | 'status' | 'origin' | 'startedAt' | 'endedAt' | 'note'
  >;
  readonly exerciseIds: readonly ExerciseId[];
  readonly doneSets: number;
  readonly prs: number;
}

export interface SessionFilter {
  /** Matches exercise names (via `nameOf`) and the session note, case- and accent-insensitive. */
  readonly query?: string;
  readonly exerciseIds?: readonly ExerciseId[];
  readonly statuses?: readonly Session['status'][];
  readonly origins?: readonly Session['origin'][];
  readonly from?: LocalDate;
  readonly to?: LocalDate;
  readonly withPrs?: boolean;
}

/** ANL-06 session list: newest first, filtered (AND across filters). */
export function filterSessions(
  items: readonly SessionListItem[],
  filter: SessionFilter,
  nameOf: (id: ExerciseId) => string | null,
): SessionListItem[] {
  const query = filter.query ? fold(filter.query.trim()) : '';
  return items
    .filter((item) => {
      const { session } = item;
      if (filter.from !== undefined && session.localDate < filter.from) return false;
      if (filter.to !== undefined && session.localDate > filter.to) return false;
      if (filter.statuses && !filter.statuses.includes(session.status)) return false;
      if (filter.origins && !filter.origins.includes(session.origin)) return false;
      if (filter.withPrs && item.prs === 0) return false;
      if (filter.exerciseIds && !filter.exerciseIds.some((id) => item.exerciseIds.includes(id))) {
        return false;
      }
      if (query === '') return true;
      const haystack = [...item.exerciseIds.map((id) => nameOf(id) ?? ''), session.note ?? ''].map(
        fold,
      );
      return query.split(/\s+/).every((word) => haystack.some((text) => text.includes(word)));
    })
    .toSorted((a, b) => b.session.startedAt.epochMs - a.session.startedAt.epochMs);
}

/** Lower case without diacritics, for matching names typed without accents. */
export function fold(text: string): string {
  return text.normalize('NFD').replaceAll(/\p{M}/gu, '').toLowerCase();
}

function groupBy<T, K>(items: readonly T[], key: (item: T) => K): Map<K, T[]> {
  const map = new Map<K, T[]>();
  for (const item of items) map.set(key(item), [...(map.get(key(item)) ?? []), item]);
  return map;
}
