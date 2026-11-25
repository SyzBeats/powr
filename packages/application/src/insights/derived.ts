import { weekStartOf, type LocalDate, type LoggedSet, type SessionId } from '@powr/domain';
import { buildWeek, type WeeklyRecord } from '@powr/domain/analytics';
import { derivationKey } from '@powr/domain/session';
import { breakDaysIn, computeStreak } from '@powr/domain/streaks';

import type { Deps } from '../deps';
import type { StreakRecord, StreakWeekEntry } from '../ports';
import {
  ALL_FROM,
  ALL_TO,
  groupByWeek,
  insightsContext,
  targetsForWeek,
  weekEnd,
  weekKey,
  type InsightsContext,
  type WeekRaw,
} from './context';

/*
 * The M4a derived tables (technical concept §8.2.2, §8.2.8; TD-43), in the M3a
 * fingerprint-and-rebuild pattern: `dWeekly` holds one record per user week that has a finished or
 * partial session or a planned session; its `key` fingerprints the versions, the overrides, the
 * week start, the plan targets in force, the week's break days and every raw record of the week
 * (session and planned-session revisions, which every edit bumps). `dStreak` holds the streak
 * with each recorded week's contribution, so a changed week updates it without reading every
 * other week. `ensureInsights` compares the fingerprints of a date range with the stored records
 * and rebuilds what is stale, missing or gone; without a stored streak (a restore, a cleared
 * database) it rebuilds the whole history. Finishing, editing, deleting and backdating a session
 * schedule a rebuild of its week after their own commit, so logging never waits for it (§6.9).
 * Rebuilds run one at a time per container (no older result overwrites a newer one).
 */

export interface InsightsReport {
  readonly rebuiltWeeks: number;
  readonly removedWeeks: number;
  readonly streak: boolean;
}

const QUEUES = new WeakMap<Deps, Promise<unknown>>();

function serialized<T>(deps: Deps, task: () => Promise<T>): Promise<T> {
  const previous = QUEUES.get(deps) ?? Promise.resolve();
  const next = previous.then(task, task);
  QUEUES.set(
    deps,
    next.catch(() => undefined),
  );
  return next;
}

/** Rebuilds the stale, missing or extra weeks of a range (default: everything) and the streak. */
export function ensureInsights(
  deps: Deps,
  range?: { readonly from: LocalDate; readonly to: LocalDate },
): Promise<InsightsReport> {
  return serialized(deps, async () => ensureNow(deps, await insightsContext(deps), range));
}

/** Drops `dWeekly` and `dStreak` and rebuilds them from the raw logs ("Verify data", tests). */
export function rebuildInsights(deps: Deps): Promise<InsightsReport> {
  return serialized(deps, async () => {
    await deps.uow.write(['dWeekly', 'dStreak'], async (repos) => {
      const stored = await repos.insights.weeks(ALL_FROM, ALL_TO);
      await repos.insights.deleteWeeks(stored.map((record) => record.weekStart));
    });
    return ensureNow(deps, await insightsContext(deps), undefined, true);
  });
}

/**
 * After a session was finished, edited, deleted or logged for a past day: rebuilds the weeks of
 * these days. Never throws and is not awaited by the logging path (§6.9 "never block logging").
 */
export function scheduleInsightsRefresh(deps: Deps, dates: readonly LocalDate[]): void {
  if (dates.length === 0) return;
  const sorted = dates.toSorted();
  ensureInsights(deps, { from: sorted[0]!, to: sorted.at(-1)! }).catch(() => undefined);
}

async function ensureNow(
  deps: Deps,
  ctx: InsightsContext,
  range: { readonly from: LocalDate; readonly to: LocalDate } | undefined,
  forceStreak = false,
): Promise<InsightsReport> {
  const existing = await deps.uow.read(['dStreak'], (repos) => repos.insights.streak());
  // The whole history is rebuilt without a stored streak (restore, first run, cleared tables) and
  // when the weeks' non-raw inputs changed (versions, overrides, week start): every week is stale.
  const full =
    range === undefined ||
    existing === undefined ||
    existing.baseKey !== ctx.baseKey ||
    forceStreak;
  const from = full ? ALL_FROM : weekStartOf(range.from, ctx.weekStartsOn);
  const lastDay = weekEnd(ctx.currentWeek);
  const to = full ? lastDay : weekEnd(weekStartOf(range.to, ctx.weekStartsOn));
  const until = to < lastDay ? to : lastDay;
  if (from > until) return { rebuiltWeeks: 0, removedWeeks: 0, streak: false };

  const raw = await deps.uow.read(
    ['sessions', 'plannedSessions', 'breaks', 'plans', 'dWeekly', 'dStreak'],
    async (repos) => ({
      sessions: await repos.sessions.inRange(from, until),
      planned: await repos.plannedSessions.inRange(from, until),
      breaks: await repos.breaks.list(),
      plans: await repos.plans.list(),
      stored: await repos.insights.weeks(from, until),
      streak: await repos.insights.streak(),
    }),
  );
  const weeks = groupByWeek(raw.sessions, raw.planned, ctx.weekStartsOn);
  const expected = new Map<LocalDate, { week: WeekRaw; key: string }>();
  for (const [weekStart, week] of weeks) {
    const targets = targetsForWeek(raw.plans, weekStart);
    expected.set(weekStart, { week, key: weekKey(ctx.baseKey, week, targets, raw.breaks) });
  }
  const stored = new Map(raw.stored.map((record) => [record.weekStart, record]));
  const stale = [...expected].filter(
    ([weekStart, entry]) => stored.get(weekStart)?.key !== entry.key,
  );
  const removed = raw.stored
    .filter((record) => !expected.has(record.weekStart))
    .map((record) => record.weekStart);
  const streakKey = derivationKey({
    base: ctx.streakKey,
    breaks: raw.breaks
      .map((entry) => [entry.id, entry.startDate, entry.endDate])
      .toSorted((a, b) => (String(a[0]) < String(b[0]) ? -1 : 1)),
  });
  const streakFresh = raw.streak !== undefined && raw.streak.key === streakKey;
  if (stale.length === 0 && removed.length === 0 && streakFresh && !forceStreak) {
    return { rebuiltWeeks: 0, removedWeeks: 0, streak: false };
  }

  const sessionIds = stale.flatMap(([, entry]) => entry.week.sessions.map((session) => session.id));
  const sets = await deps.uow.read(['sets'], async (repos) => {
    const bySession = new Map<SessionId, LoggedSet[]>();
    for (const id of sessionIds) bySession.set(id, await repos.sets.bySession(id));
    return bySession;
  });
  const built: WeeklyRecord[] = stale.map(([weekStart, entry]) =>
    buildWeek(
      {
        weekStart,
        key: entry.key,
        sessions: entry.week.sessions.map((session) => ({
          session,
          sets: sets.get(session.id) ?? [],
        })),
        planned: entry.week.planned,
        breaks: raw.breaks,
        targets: targetsForWeek(raw.plans, weekStart),
      },
      ctx.weekly,
    ),
  );

  // The streak: every recorded week's contribution; a ranged rebuild replaces its weeks only.
  const fresh = new Map<LocalDate, WeeklyRecord>(built.map((record) => [record.weekStart, record]));
  const inRange: StreakWeekEntry[] = [...expected].map(([weekStart, entry]) =>
    streakEntry(fresh.get(weekStart) ?? stored.get(weekStart)!, entry.week),
  );
  const outside = full
    ? []
    : (raw.streak?.inputs ?? []).filter(
        (entry) => entry.weekStart < from || entry.weekStart > until,
      );
  const inputs = [...outside, ...inRange].toSorted((a, b) =>
    a.weekStart < b.weekStart ? -1 : a.weekStart > b.weekStart ? 1 : 0,
  );
  const firstActivity = inputs.reduce<LocalDate | null>(
    (first, entry) => (first === null || entry.firstDay < first ? entry.firstDay : first),
    null,
  );
  const streak = computeStreak(
    {
      weeks: inputs,
      currentWeek: ctx.currentWeek,
      firstActivity,
      weeklyTarget: ctx.preferences.weeklySessionTarget,
      grace: ctx.preferences.streakGrace,
      weekStartsOn: ctx.weekStartsOn,
      breakDaysOf: (weekStart) => breakDaysIn(weekStart, raw.breaks),
    },
    ctx.prepared.rules(null),
  ).value;
  const record: StreakRecord = { id: 'me', key: streakKey, baseKey: ctx.baseKey, inputs, streak };

  await deps.uow.write(['dWeekly', 'dStreak'], async (repos) => {
    if (built.length > 0) await repos.insights.putWeeks(built);
    if (removed.length > 0) await repos.insights.deleteWeeks(removed);
    await repos.insights.putStreak(record);
  });
  return { rebuiltWeeks: built.length, removedWeeks: removed.length, streak: true };
}

/** A week's contribution to the streak (MOT-03/04). */
function streakEntry(record: WeeklyRecord, week: WeekRaw): StreakWeekEntry {
  const days = [
    ...week.sessions.map((session) => session.localDate),
    ...week.planned.map((entry) => entry.localDate),
  ].toSorted();
  return {
    weekStart: record.weekStart,
    done: record.sessions.counting,
    planned: record.planned.asked,
    onBreak: record.planned.onBreak,
    deload: record.planned.deload,
    breakDays: record.breakDays,
    firstDay: days[0] ?? record.weekStart,
  };
}
