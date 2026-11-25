import {
  ENGINE_VERSION,
  addDays,
  toLocalDate,
  weekStartOf,
  type IsoWeekday,
  type LocalDate,
  type Plan,
  type PlannedSession,
  type Session,
  type TrainingBreak,
} from '@powr/domain';
import { WEEKLY_VERSION, type WeeklyContext, type WeeklyTargets } from '@powr/domain/analytics';
import { derivationKey } from '@powr/domain/session';
import { breakDaysIn } from '@powr/domain/streaks';
import type { SettingsRecord } from '@powr/formats';

import type { Deps } from '../deps';
import { prepare, type Prepared } from '../session/context';

/*
 * What every insight use case needs before it reads (rules resolve asynchronously, §8.2.4): the
 * session engine's prepared context (rules per exercise, level, profile, plan, bodyweight trend),
 * the user's week start (SET-11), today, the insight preferences and the fingerprint of every
 * non-raw input of the derived weeks (§8.2.8).
 */

/** The widest date range (full rebuilds and "everything" queries). */
export const ALL_FROM = '1970-01-01' as LocalDate;
export const ALL_TO = '9999-12-31' as LocalDate;

export interface InsightPreferences {
  /** MOT-03, A-07: one missed session per week keeps the week (default off). */
  readonly streakGrace: boolean;
  /** MOT-03 freestyle weekly target; null: the registry default. */
  readonly weeklySessionTarget: number | null;
  readonly scoreSource: 'e1rm' | 'tested';
  readonly division: 'classic' | 'equipped' | null;
}

export function insightPreferences(settings: SettingsRecord | undefined): InsightPreferences {
  const stored = settings?.insights;
  return {
    streakGrace: stored?.streakGrace ?? false,
    weeklySessionTarget: stored?.weeklySessionTarget ?? null,
    scoreSource: stored?.scoreSource ?? 'e1rm',
    division: stored?.division ?? null,
  };
}

export interface InsightsContext {
  readonly prepared: Prepared;
  readonly weekStartsOn: IsoWeekday;
  readonly today: LocalDate;
  readonly currentWeek: LocalDate;
  readonly preferences: InsightPreferences;
  /** Fingerprint of the derived weeks' non-raw inputs (versions, overrides, week start). */
  readonly baseKey: string;
  /** Fingerprint of the streak's non-raw inputs (with the current week). */
  readonly streakKey: string;
  readonly weekly: WeeklyContext;
}

export async function insightsContext(deps: Deps): Promise<InsightsContext> {
  const prepared = await prepare(deps);
  const weekStartsOn = (prepared.settings?.weekStart ??
    prepared.plan?.schedule.weekStartsOn ??
    1) as IsoWeekday;
  const today = toLocalDate(deps.clock.now());
  const currentWeek = weekStartOf(today, weekStartsOn);
  const preferences = insightPreferences(prepared.settings);
  const baseKey = baseKeyOf(deps, prepared.settings?.overrides ?? [], weekStartsOn);
  return {
    prepared,
    weekStartsOn,
    today,
    currentWeek,
    preferences,
    baseKey,
    streakKey: derivationKey({
      base: baseKey,
      currentWeek,
      grace: preferences.streakGrace,
      weeklyTarget: preferences.weeklySessionTarget,
    }),
    weekly: {
      exercise: (id) => deps.content.exercise(id),
      rules: prepared.rules,
    },
  };
}

/** The fingerprint of the derived weeks' non-raw inputs (versions, overrides, week start). */
export function baseKeyOf(
  deps: Deps,
  overrides: NonNullable<SettingsRecord['overrides']>,
  weekStartsOn: IsoWeekday,
): string {
  return derivationKey({
    engine: ENGINE_VERSION,
    weekly: WEEKLY_VERSION,
    rules: deps.rules.version,
    content: deps.content.version,
    overrides,
    weekStartsOn,
  });
}

/** The last day of the week that starts on `weekStart`. */
export const weekEnd = (weekStart: LocalDate): LocalDate => addDays(weekStart, 6);

/**
 * The plan's weekly targets in force in a week (PLN-03): the mesocycle whose weeks cover the
 * week's first day, the active plan first, then the most recently created plan.
 */
export function targetsForWeek(plans: readonly Plan[], weekStart: LocalDate): WeeklyTargets | null {
  const ordered = plans.toSorted(
    (a, b) =>
      Number(b.status === 'active') - Number(a.status === 'active') ||
      b.createdAt.epochMs - a.createdAt.epochMs,
  );
  const last = weekEnd(weekStart);
  for (const plan of ordered) {
    for (const mesocycle of plan.mesocycles) {
      const end = addDays(
        mesocycle.startDate,
        (mesocycle.accumulationWeeks + mesocycle.deloadWeeks) * 7 - 1,
      );
      if (mesocycle.startDate <= last && end >= weekStart) {
        return {
          planId: plan.id,
          mesocycleIndex: mesocycle.index,
          muscles: mesocycle.targets,
          lifts: mesocycle.liftTargets,
        };
      }
    }
  }
  return null;
}

/** The raw records a week is built from, grouped by week. */
export interface WeekRaw {
  readonly weekStart: LocalDate;
  readonly sessions: Session[];
  readonly planned: PlannedSession[];
}

/** Sessions and planned sessions by user week; weeks with neither are left out. */
export function groupByWeek(
  sessions: readonly Session[],
  planned: readonly PlannedSession[],
  weekStartsOn: IsoWeekday,
): Map<LocalDate, WeekRaw> {
  const weeks = new Map<LocalDate, WeekRaw>();
  const weekOf = (date: LocalDate) => {
    const weekStart = weekStartOf(date, weekStartsOn);
    let week = weeks.get(weekStart);
    if (!week) {
      week = { weekStart, sessions: [], planned: [] };
      weeks.set(weekStart, week);
    }
    return week;
  };
  for (const session of sessions) {
    if (session.status === 'finished' || session.status === 'partial') {
      weekOf(session.localDate).sessions.push(session);
    }
  }
  for (const entry of planned) weekOf(entry.localDate).planned.push(entry);
  return weeks;
}

/**
 * A week's fingerprint (§8.2.8): the non-raw inputs, the plan targets in force and every raw
 * record the week is built from (sessions with their revision, which every edit bumps; planned
 * sessions with theirs; the days inside breaks). A changed fingerprint means a stale week.
 */
export function weekKey(
  baseKey: string,
  week: WeekRaw,
  targets: WeeklyTargets | null,
  breaks: readonly Pick<TrainingBreak, 'startDate' | 'endDate'>[],
): string {
  return derivationKey({
    base: baseKey,
    targets,
    breakDays: breakDaysIn(week.weekStart, breaks),
    sessions: week.sessions
      .map((session) => [session.id, session.status, session.revision, session.localDate])
      .toSorted(compareFirst),
    planned: week.planned
      .map((entry) => [entry.id, entry.status, entry.kind, entry.revision, entry.localDate])
      .toSorted(compareFirst),
  });
}

function compareFirst(a: readonly unknown[], b: readonly unknown[]): number {
  const x = String(a[0]);
  const y = String(b[0]);
  return x < y ? -1 : x > y ? 1 : 0;
}
