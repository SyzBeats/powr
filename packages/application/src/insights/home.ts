import {
  addDays,
  daysBetween,
  toLocalDate,
  weekStartOf,
  type ExerciseId,
  type IsoWeekday,
  type LocalDate,
  type MeetInfo,
  type PlannedSession,
  type Session,
  type SessionId,
} from '@powr/domain';
import {
  scoreBoard,
  volumeRows,
  type MuscleWeekRow,
  type ScoreBoard,
  type WeeklyRecord,
} from '@powr/domain/analytics';
import {
  bodyweightRate,
  bodyweightTrend,
  firstReadingPerDay,
  rateBand,
  type BodyweightRate,
  type RateBand,
} from '@powr/domain/bodyweight';
import type { Explained } from '@powr/domain/explain';
import {
  currentE1rm,
  type ExerciseState,
  type PointChange,
  type PrRecord,
  type SessionE1rmPoint,
} from '@powr/domain/session';
import type { StreakWeek } from '@powr/domain/streaks';

import type { Deps } from '../deps';
import type { Observable, Repositories, StreakRecord, TableName } from '../ports';
import {
  PREPARE_TABLES,
  loadPrepareInputs,
  prepareFrom,
  type PrepareInputs,
} from '../session/context';
import {
  baseKeyOf,
  groupByWeek,
  insightPreferences,
  targetsForWeek,
  weekEnd,
  weekKey,
} from './context';
import { ensureInsights } from './derived';

/*
 * The Home dashboard (ANL-01): one live query over small, indexed reads (this week's records,
 * the streak record, the last session, recent PRs and e1RM points, the bodyweight log), mapped to
 * one view: today's session or "rest day" with the next one, the last session, this week's
 * progress against the plan with its mini heat map and the streak (MOT-03), recent PRs and
 * "likely real" trend changes, the bodyweight trend and rate, the meet countdown and the current
 * total and points for powerlifters. When the derived weeks or the streak are stale (a finish the
 * refresh has not reached yet, a restore, a new week), the view says so and a rebuild runs in the
 * background; its commit re-runs the query. Nothing here blocks logging.
 */

export interface HomeNext {
  readonly plannedSessionId: PlannedSession['id'];
  readonly name: PlannedSession['name'];
  readonly localDate: LocalDate;
  readonly kind: PlannedSession['kind'];
  readonly adjustments: readonly PlannedSession['adjustments'][number]['kind'][];
  readonly isToday: boolean;
}

export interface HomeLastSession {
  readonly sessionId: SessionId;
  readonly localDate: LocalDate;
  readonly status: Session['status'];
  readonly durationMs: number | null;
  readonly doneSets: number;
  readonly exerciseIds: readonly ExerciseId[];
  readonly prs: readonly PrRecord[];
}

export interface HomeTrendChange {
  readonly exerciseId: ExerciseId;
  readonly localDate: LocalDate;
  readonly sessionId: SessionId;
  readonly change: PointChange;
  readonly e1rmKg: number | null;
}

export interface HomeBodyweight {
  readonly latestKg: number;
  readonly trendKg: number | null;
  readonly latestDate: LocalDate;
  /** The last 28 days of the trend (the sparkline, §8.10 "Home sparklines"). */
  readonly sparkline: readonly { readonly localDate: LocalDate; readonly trendKg: number | null }[];
  readonly rate: Explained<BodyweightRate | null>;
  readonly band: Explained<RateBand>;
}

export interface HomeView {
  readonly today: LocalDate;
  readonly weekStart: LocalDate;
  readonly activeSession: { readonly id: SessionId; readonly startedAtEpochMs: number } | null;
  /** Today's planned session, or the next one ("Rest day", ANL-01). */
  readonly next: HomeNext | null;
  readonly restDay: boolean;
  readonly lastSession: HomeLastSession | null;
  readonly week: {
    /** MOT-03 "2 of 4": done and asked-for sessions, the state of the week. */
    readonly progress: StreakWeek | null;
    /** The mini heat map (MAP-04), one row per display group. */
    readonly volume: readonly MuscleWeekRow[];
    readonly minutes: number;
  };
  readonly streak: { readonly current: number; readonly best: number } | null;
  readonly recentPrs: readonly PrRecord[];
  readonly trendChanges: readonly HomeTrendChange[];
  readonly bodyweight: HomeBodyweight | null;
  readonly meet: { readonly date: LocalDate; readonly daysUntil: number } | null;
  /** Powerlifters: the current total and points (ANL-01, ANL-07). */
  readonly scores: ScoreBoard | null;
  readonly lastBackupAt: string | null;
  /** The derived weeks or the streak are being rebuilt; the view updates when they are done. */
  readonly refreshing: boolean;
}

const HOME_TABLES: readonly TableName[] = [
  ...PREPARE_TABLES,
  'sessions',
  'sets',
  'plannedSessions',
  'breaks',
  'meets',
  'meta',
  'dWeekly',
  'dStreak',
  'dPrs',
  'dSessionE1rm',
  'dExerciseState',
];

const RECENT_DAYS = 28;
const LAST_SESSION_DAYS = 120;

/** The raw bundle Home reads in one transaction. */
interface HomeBundle {
  readonly inputs: PrepareInputs;
  readonly plans: Awaited<ReturnType<Repositories['plans']['list']>>;
  readonly today: LocalDate;
  readonly weekStartsOn: IsoWeekday;
  readonly active: Session | undefined;
  readonly sessions: readonly Session[];
  readonly lastSets: readonly { readonly state: string; readonly exerciseId: ExerciseId }[];
  readonly lastPrs: readonly PrRecord[];
  readonly planned: readonly PlannedSession[];
  readonly breaks: Awaited<ReturnType<Repositories['breaks']['list']>>;
  readonly meets: readonly MeetInfo[];
  readonly weeks: readonly WeeklyRecord[];
  readonly streak: StreakRecord | undefined;
  readonly prs: readonly PrRecord[];
  readonly points: readonly SessionE1rmPoint[];
  readonly liftStates: readonly ExerciseState[];
  readonly lastBackupAt: string | null;
}

async function readHome(deps: Deps, repos: Repositories): Promise<HomeBundle> {
  const today = toLocalDate(deps.clock.now());
  const inputs = await loadPrepareInputs(repos);
  const weekStartsOn = (inputs.settings?.weekStart ??
    inputs.plan?.schedule.weekStartsOn ??
    1) as IsoWeekday;
  const currentWeek = weekStartOf(today, weekStartsOn);
  const previousWeek = addDays(currentWeek, -7);
  const sessions = await repos.sessions.inRange(
    addDays(today, -LAST_SESSION_DAYS),
    weekEnd(currentWeek),
  );
  const last = sessions
    .filter((session) => session.status === 'finished' || session.status === 'partial')
    .toSorted((a, b) => b.startedAt.epochMs - a.startedAt.epochMs)[0];
  const liftIds = deps.content
    .exercises()
    .filter((exercise) => exercise.competitionLift !== undefined)
    .map((exercise) => exercise.id);
  const backup = await repos.meta.get('lastBackup');
  const backupValue = backup?.value as { readonly at?: unknown } | null | undefined;
  return {
    inputs,
    plans: await repos.plans.list(),
    today,
    weekStartsOn,
    active: await repos.sessions.getActive(),
    sessions,
    lastSets: last ? await repos.sets.bySession(last.id) : [],
    lastPrs: last ? await repos.derived.prsBySession(last.id) : [],
    planned: await repos.plannedSessions.inRange(previousWeek, addDays(today, 21)),
    breaks: await repos.breaks.list(),
    meets: await repos.meets.list(),
    weeks: await repos.insights.weeks(previousWeek, currentWeek),
    streak: await repos.insights.streak(),
    prs: await repos.derived.prsInRange(addDays(today, -RECENT_DAYS), today),
    points: await repos.derived.pointsInRange(addDays(today, -RECENT_DAYS), today),
    liftStates: await repos.derived.exerciseStates(liftIds),
    lastBackupAt: typeof backupValue?.at === 'string' ? backupValue.at : null,
  };
}

/** ANL-01: the Home view, live (re-emits whenever its data changes; emissions keep their order). */
export function observeHome(deps: Deps): Observable<HomeView> {
  return {
    subscribe(observer) {
      let latest = 0;
      let closed = false;
      const subscription = deps.queries
        .observe(HOME_TABLES, (repos) => readHome(deps, repos))
        .subscribe({
          next: (bundle) => {
            const sequence = ++latest;
            homeFrom(deps, bundle).then(
              (view) => {
                if (!closed && sequence === latest) observer.next(view);
              },
              (error: unknown) => observer.error?.(error),
            );
          },
          error: (error) => observer.error?.(error),
        });
      return {
        unsubscribe: () => {
          closed = true;
          subscription.unsubscribe();
        },
      };
    },
  };
}

/** ANL-01: the Home view once (tests, a first paint without a subscription). */
export async function homeView(deps: Deps): Promise<HomeView> {
  const bundle = await deps.uow.read(HOME_TABLES, (repos) => readHome(deps, repos));
  return homeFrom(deps, bundle);
}

async function homeFrom(deps: Deps, bundle: HomeBundle): Promise<HomeView> {
  const prepared = await prepareFrom(deps, bundle.inputs);
  const rules = prepared.rules(null);
  const { today, weekStartsOn } = bundle;
  const weekStart = weekStartOf(today, weekStartsOn);
  const preferences = insightPreferences(bundle.inputs.settings);

  const refreshing = stale(deps, bundle, weekStart);
  if (refreshing) {
    const full = bundle.streak === undefined;
    ensureInsights(
      deps,
      full ? undefined : { from: addDays(weekStart, -RECENT_DAYS), to: today },
    ).catch(() => undefined);
  }

  const thisWeek = bundle.weeks.find((record) => record.weekStart === weekStart) ?? null;
  const planned = bundle.planned.toSorted((a, b) =>
    a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0,
  );
  const todays = planned.find((entry) => entry.localDate === today && entry.status === 'planned');
  const upcoming =
    todays ?? planned.find((entry) => entry.localDate > today && entry.status === 'planned');
  const openThisWeek = planned.filter(
    (entry) =>
      entry.status === 'planned' &&
      entry.localDate >= today &&
      entry.localDate <= weekEnd(weekStart),
  );
  const last = bundle.sessions
    .filter((session) => session.status === 'finished' || session.status === 'partial')
    .toSorted((a, b) => b.startedAt.epochMs - a.startedAt.epochMs)[0];
  const streakWeek =
    bundle.streak?.streak.thisWeek?.weekStart === weekStart ? bundle.streak.streak.thisWeek : null;

  const trendChanges = latestChanges(bundle.points);
  const recentPrs = bundle.prs
    .toSorted(
      (a, b) =>
        (a.localDate < b.localDate ? 1 : a.localDate > b.localDate ? -1 : 0) ||
        (a.id < b.id ? 1 : -1),
    )
    .slice(0, 10);

  const meet = bundle.meets
    .filter((entry) => entry.date >= today)
    .toSorted((a, b) => (a.date < b.date ? -1 : 1))[0];
  const powerlifter =
    prepared.profile?.style === 'powerlifting' ||
    prepared.profile?.style === 'powerbuilding' ||
    meet !== undefined;

  return {
    today,
    weekStart,
    activeSession: bundle.active
      ? { id: bundle.active.id, startedAtEpochMs: bundle.active.startedAt.epochMs }
      : null,
    next: upcoming
      ? {
          plannedSessionId: upcoming.id,
          name: upcoming.name,
          localDate: upcoming.localDate,
          kind: upcoming.kind,
          adjustments: upcoming.adjustments.map((adjustment) => adjustment.kind),
          isToday: upcoming.localDate === today,
        }
      : null,
    restDay: todays === undefined,
    lastSession: last
      ? {
          sessionId: last.id,
          localDate: last.localDate,
          status: last.status,
          durationMs: last.endedAt ? last.endedAt.epochMs - last.startedAt.epochMs : null,
          doneSets: bundle.lastSets.filter((set) => set.state === 'done').length,
          exerciseIds: [...new Set(bundle.lastSets.map((set) => set.exerciseId))],
          prs: bundle.lastPrs,
        }
      : null,
    week: {
      progress: streakWeek,
      volume: volumeRows(
        {
          record: thisWeek ?? {
            muscles: [],
            exercises: [],
            targets: targetsForWeek(bundle.plans, weekStart),
          },
          groups: deps.content.muscles().groups,
          exercise: (id) => deps.content.exercise(id),
          openPlanned: openThisWeek,
        },
        rules,
      ),
      minutes: thisWeek?.sessions.minutes ?? 0,
    },
    streak: bundle.streak
      ? { current: bundle.streak.streak.current, best: bundle.streak.streak.best }
      : null,
    recentPrs,
    trendChanges,
    bodyweight: homeBodyweight(bundle, prepared.level, rules),
    meet: meet ? { date: meet.date, daysUntil: daysBetween(today, meet.date) } : null,
    scores: powerlifter
      ? homeScores(
          deps,
          bundle,
          prepared.profile?.referenceSet ?? null,
          preferences.division ?? meet?.division ?? 'classic',
          prepared.bodyweightAt(today),
          rules,
        )
      : null,
    lastBackupAt: bundle.lastBackupAt,
    refreshing,
  };
}

/** Whether this or last week's record or the streak no longer matches the raw data. */
function stale(deps: Deps, bundle: HomeBundle, weekStart: LocalDate): boolean {
  if (!bundle.streak) return true;
  const thisWeek = bundle.streak.streak.thisWeek;
  if (thisWeek !== null && thisWeek.weekStart !== weekStart) return true;
  if (thisWeek === null && bundle.streak.inputs.length > 0) return true;
  // The week fingerprints (the base key is the same one `ensureInsights` uses).
  const baseVersions = baseKeyFor(deps, bundle);
  if (bundle.streak.baseKey !== baseVersions) return true;
  const weeks = groupByWeek(
    bundle.sessions.filter((session) => session.localDate >= addDays(weekStart, -7)),
    bundle.planned.filter((entry) => entry.localDate <= weekEnd(weekStart)),
    bundle.weekStartsOn,
  );
  for (const start of [addDays(weekStart, -7), weekStart]) {
    const week = weeks.get(start);
    const stored = bundle.weeks.find((record) => record.weekStart === start);
    if (!week) {
      if (stored) return true;
      continue;
    }
    const key = weekKey(baseVersions, week, targetsForWeek(bundle.plans, start), bundle.breaks);
    if (stored?.key !== key) return true;
  }
  return false;
}

/** The same base fingerprint as `insightsContext` (versions, overrides, week start). */
function baseKeyFor(deps: Deps, bundle: HomeBundle): string {
  return baseKeyOf(deps, bundle.inputs.settings?.overrides ?? [], bundle.weekStartsOn);
}

function latestChanges(points: readonly SessionE1rmPoint[]): HomeTrendChange[] {
  const byExercise = new Map<ExerciseId, SessionE1rmPoint>();
  for (const point of points) {
    const known = byExercise.get(point.exerciseId);
    if (!known || point.localDate > known.localDate) byExercise.set(point.exerciseId, point);
  }
  return [...byExercise.values()]
    .flatMap((point) =>
      point.change && (point.change.label === 'likely' || point.change.label === 'veryLikely')
        ? [
            {
              exerciseId: point.exerciseId,
              localDate: point.localDate,
              sessionId: point.sessionId,
              change: point.change,
              e1rmKg: point.strength?.e1rmKg ?? null,
            },
          ]
        : [],
    )
    .toSorted((a, b) => (a.localDate < b.localDate ? 1 : a.localDate > b.localDate ? -1 : 0))
    .slice(0, 5);
}

function homeBodyweight(
  bundle: HomeBundle,
  level: 'novice' | 'intermediate' | 'advanced',
  rules: Parameters<typeof bodyweightTrend>[1] &
    Parameters<typeof bodyweightRate>[1] &
    Parameters<typeof rateBand>[3],
): HomeBodyweight | null {
  const daily = firstReadingPerDay(bundle.inputs.bodyweights);
  const latest = daily.at(-1);
  if (!latest) return null;
  const points = bodyweightTrend(
    daily.map((entry) => ({ localDate: entry.localDate, mass: entry.mass })),
    rules,
  ).value;
  const rate = bodyweightRate(points, rules);
  const weeklyRates = [0, 7, 14].map(
    (days) =>
      bodyweightRate(
        points.filter((point) => point.localDate <= addDays(latest.localDate, -days)),
        rules,
      ).value?.pctPerWeek ?? null,
  );
  const phase = bundle.inputs.profile?.phase ?? 'notTracking';
  const last = points.at(-1);
  return {
    latestKg: last?.rawKg ?? 0,
    trendKg: last?.trendKg ?? null,
    latestDate: latest.localDate,
    sparkline: points
      .filter((point) => point.localDate >= addDays(bundle.today, -RECENT_DAYS))
      .map((point) => ({ localDate: point.localDate, trendKg: point.trendKg })),
    rate,
    band: rateBand(weeklyRates, phase, level, rules),
  };
}

/** ANL-01 "current total/points": the competition lifts' current e1RMs (the best per lift). */
function homeScores(
  deps: Deps,
  bundle: HomeBundle,
  sex: 'male' | 'female' | null,
  division: 'classic' | 'equipped',
  bodyweightKg: number | null,
  rules: Parameters<typeof scoreBoard>[1],
): ScoreBoard {
  const lifts = (['squat', 'bench', 'deadlift'] as const).map((lift) => {
    let best: { exerciseId: ExerciseId; kg: number } | null = null;
    for (const state of bundle.liftStates) {
      const kg = currentE1rm(state);
      if (kg === null || deps.content.exercise(state.exerciseId)?.competitionLift !== lift)
        continue;
      if (best === null || kg > best.kg) best = { exerciseId: state.exerciseId, kg };
    }
    return { lift, exerciseId: best?.exerciseId ?? null, kg: best?.kg ?? null };
  });
  return scoreBoard({ sex, division, source: 'e1rm', bodyweightKg, lifts, history: [] }, rules);
}
