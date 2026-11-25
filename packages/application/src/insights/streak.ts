import {
  addDays,
  weekStartOf,
  type BreakId,
  type BreakReason,
  type LocalDate,
  type MeasurementSite,
  type SessionId,
  type TrainingBreak,
} from '@powr/domain';
import type { Explanation } from '@powr/domain/explain';
import { pauseForBreak } from '@powr/domain/planning';
import {
  breakDaysIn,
  canMarkBreak,
  computeStreak,
  countsForStreak,
  explainWeek,
  streakChange,
  type Streak,
  type StreakChange,
  type StreakWeek,
} from '@powr/domain/streaks';
import type { SettingsRecord } from '@powr/formats';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import { insightsContext, weekEnd } from './context';
import { ensureInsights } from './derived';

/*
 * The weekly streak (MOT-03) and its fairness rules (MOT-04): the current and best streak, every
 * week's state with its "Why?" (kept, kept with the grace, missed, paused by a break, pending),
 * the weeks that may still be marked as a break (up to four weeks back), and the user's choices
 * (grace, freestyle weekly target). Tone (MOT-10): the states are facts, never blame.
 */

export interface StreakView {
  readonly current: number;
  readonly best: number;
  readonly bestEndedWeek: LocalDate | null;
  readonly thisWeek: StreakWeek | null;
  /** Newest first, each with its "Why?". */
  readonly weeks: readonly (StreakWeek & { readonly why: Explanation })[];
  /** Past weeks (and the current one) that can still be marked as a break (MOT-04). */
  readonly markableWeeks: readonly LocalDate[];
  readonly grace: boolean;
  readonly weeklySessionTarget: number | null;
}

/** MOT-03/04: the streak, rebuilt first where stale. */
export async function streakView(
  deps: Deps,
  input: { readonly weeks?: number } = {},
): Promise<StreakView> {
  await ensureInsights(deps, await recentRange(deps));
  const ctx = await insightsContext(deps);
  const record = await deps.uow.read(['dStreak'], (repos) => repos.insights.streak());
  const streak: Streak = record?.streak ?? {
    current: 0,
    best: 0,
    bestEndedWeek: null,
    weeks: [],
    thisWeek: null,
  };
  const limit = ctx.prepared.rules(null)['motivation.streak.retroactiveBreakWeeks'];
  const markable: LocalDate[] = [];
  for (let back = 0; back <= limit.value; back++) {
    const week = addDays(ctx.currentWeek, -7 * back);
    const state = streak.weeks.find((entry) => entry.weekStart === week)?.state;
    if (state !== 'paused') markable.push(week);
  }
  return {
    current: streak.current,
    best: streak.best,
    bestEndedWeek: streak.bestEndedWeek,
    thisWeek: streak.thisWeek,
    weeks: streak.weeks
      .toReversed()
      .slice(0, input.weeks ?? 26)
      .map((week) => ({ ...week, why: explainWeek(week) })),
    markableWeeks: markable,
    grace: ctx.preferences.streakGrace,
    weeklySessionTarget: ctx.preferences.weeklySessionTarget,
  };
}

async function recentRange(deps: Deps): Promise<{ from: LocalDate; to: LocalDate }> {
  const ctx = await insightsContext(deps);
  return { from: addDays(ctx.currentWeek, -28), to: weekEnd(ctx.currentWeek) };
}

export type MarkBreakError =
  | { readonly kind: 'tooFarBack' }
  | { readonly kind: 'future' }
  | { readonly kind: 'alreadyBreak' };

/**
 * MOT-04: marks a week (the current one or up to four weeks back) as a break: a break record for
 * the week, its open planned sessions paused (PLN-12), then the streak is rebuilt. The week
 * neither keeps nor breaks the streak.
 */
export async function markWeekAsBreak(
  deps: Deps,
  input: { readonly weekStart: LocalDate; readonly reason: BreakReason; readonly note?: string },
): Promise<Result<TrainingBreak, MarkBreakError>> {
  const ctx = await insightsContext(deps);
  const weekStart = weekStartOf(input.weekStart, ctx.weekStartsOn);
  if (weekStart > ctx.currentWeek) return err({ kind: 'future' });
  if (!canMarkBreak(weekStart, ctx.currentWeek, ctx.prepared.rules(null)))
    return err({ kind: 'tooFarBack' });
  const entry: TrainingBreak = {
    id: deps.ids.next() as BreakId,
    startDate: weekStart,
    endDate: weekEnd(weekStart),
    reason: input.reason,
    ...(input.note ? { note: input.note.slice(0, 2000) } : {}),
    createdAt: deps.clock.now(),
  };
  const result = await deps.uow.write(['breaks', 'plannedSessions'], async (repos) => {
    const covered = (await repos.breaks.list()).some(
      (existing) =>
        existing.startDate <= weekStart &&
        (existing.endDate === null || existing.endDate >= weekEnd(weekStart)),
    );
    if (covered) return err({ kind: 'alreadyBreak' as const });
    await repos.breaks.put(entry);
    const week = await repos.plannedSessions.inRange(weekStart, weekEnd(weekStart));
    await repos.plannedSessions.putMany(pauseForBreak(week, entry));
    return ok(entry);
  });
  if (!result.ok) return result;
  await ensureInsights(deps, { from: weekStart, to: weekEnd(weekStart) });
  return result;
}

export interface InsightPreferencesPatch {
  readonly streakGrace?: boolean;
  readonly weeklySessionTarget?: number | null;
  readonly measurementSites?: readonly MeasurementSite[];
  readonly scoreSource?: 'e1rm' | 'tested';
  readonly division?: 'classic' | 'equipped';
}

/** MOT-03 grace and freestyle target, BOD-03 sites, ANL-07 score source and division. */
export async function updateInsightPreferences(
  deps: Deps,
  patch: InsightPreferencesPatch,
): Promise<Result<void, { readonly kind: 'invalidTarget' }>> {
  const target = patch.weeklySessionTarget;
  if (
    target !== undefined &&
    target !== null &&
    !(Number.isInteger(target) && target >= 1 && target <= 14)
  )
    return err({ kind: 'invalidTarget' });
  await deps.uow.write(['settings'], async (repos) => {
    const current: SettingsRecord = (await repos.settings.get()) ?? { id: 'me', theme: 'system' };
    await repos.settings.put({
      ...current,
      insights: {
        ...current.insights,
        ...(patch.streakGrace === undefined ? {} : { streakGrace: patch.streakGrace }),
        ...(target === undefined ? {} : { weeklySessionTarget: target }),
        ...(patch.measurementSites === undefined
          ? {}
          : { measurementSites: [...new Set(patch.measurementSites)] }),
        ...(patch.scoreSource === undefined ? {} : { scoreSource: patch.scoreSource }),
        ...(patch.division === undefined ? {} : { division: patch.division }),
      },
    });
  });
  if (patch.streakGrace !== undefined || target !== undefined)
    await ensureInsights(deps, await recentRange(deps));
  return ok(undefined);
}

/**
 * MOT-02/03 celebration data for a finished session: whether it grew the streak (its week became
 * kept, or a new best). Compares the streak with the one without this session, so it does not
 * matter whether the rebuild after the finish already ran. Null when the session changed nothing.
 */
export async function sessionStreakChange(
  deps: Deps,
  sessionId: SessionId,
): Promise<StreakChange | null> {
  const ctx = await insightsContext(deps);
  const loaded = await deps.uow.read(['sessions', 'sets'], async (repos) => ({
    session: await repos.sessions.get(sessionId),
    sets: await repos.sets.bySession(sessionId),
  }));
  const { session } = loaded;
  const rules = ctx.prepared.rules(null);
  if (!session || !countsForStreak(session, loaded.sets, rules)) return null;
  await ensureInsights(deps, { from: session.localDate, to: session.localDate });
  const stored = await deps.uow.read(['dStreak', 'breaks'], async (repos) => ({
    record: await repos.insights.streak(),
    breaks: await repos.breaks.list(),
  }));
  if (!stored.record) return null;
  const week = weekStartOf(session.localDate, ctx.weekStartsOn);
  const inputs = stored.record.inputs.map((entry) =>
    entry.weekStart === week ? { ...entry, done: Math.max(0, entry.done - 1) } : entry,
  );
  const firstActivity = inputs.reduce<LocalDate | null>(
    (first, entry) => (first === null || entry.firstDay < first ? entry.firstDay : first),
    null,
  );
  const without = computeStreak(
    {
      weeks: inputs,
      currentWeek: ctx.currentWeek,
      firstActivity,
      weeklyTarget: ctx.preferences.weeklySessionTarget,
      grace: ctx.preferences.streakGrace,
      weekStartsOn: ctx.weekStartsOn,
      breakDaysOf: (weekStart) => breakDaysIn(weekStart, stored.breaks),
    },
    rules,
  ).value;
  return streakChange(without, stored.record.streak);
}
