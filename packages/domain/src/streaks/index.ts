/**
 * `@powr/domain/streaks`: the weekly adherence streak (MOT-03) and its fairness rules (MOT-04).
 * No daily streaks. A week (from the user's week start, SET-11) is kept when its completed
 * sessions reach its target: the plan's sessions that week (deload weeks with their planned
 * sessions), or the freestyle weekly target when no plan session falls in it. Sessions on
 * unscheduled days count; a partial session counts when at least half of its planned working sets
 * were done. With the optional grace (A-07) one missed session still keeps the week. Breaks
 * (PLN-12: vacation, illness, travel, injury; retroactive ones up to four weeks back, MOT-04)
 * pause: a week inside a break neither keeps nor breaks the streak, and a partly covered week
 * only asks for the sessions outside the break. A missed week resets the current streak to 0 and
 * never touches the best one. The current week can only add to the streak: until it is kept it is
 * pending, never missed. Tone (MOT-10): the states are facts, never blame.
 */
import { explain, explained, type Explained, type Explanation } from '../explain';
import type { LocalDate } from '../ids';
import type { LoggedSet, Session } from '../model';
import type { RuleSlice } from '../rules';
import { addDays, daysBetween, weekStartOf, type IsoWeekday } from '../time';

export type StreakRules = RuleSlice<
  | 'motivation.streak.graceSessions'
  | 'motivation.streak.defaultWeeklyTarget'
  | 'motivation.streak.retroactiveBreakWeeks'
>;

/** What one week contributes; weeks without any entry count as empty weeks. */
export interface StreakWeekInput {
  readonly weekStart: LocalDate;
  /** Completed sessions that count (finished, or partial with enough working sets). */
  readonly done: number;
  /** Planned sessions that still ask to be done: planned, done or skipped (not merged, not paused). */
  readonly planned: number;
  /** Planned sessions a break paused (status `onBreak`). */
  readonly onBreak: number;
  /** The week holds a deload session (PRG-11): it counts with its planned sessions. */
  readonly deload: boolean;
  /** Days of the week inside a break (0–7). */
  readonly breakDays: number;
}

export interface StreakInput {
  readonly weeks: readonly StreakWeekInput[];
  /** The week of "today". */
  readonly currentWeek: LocalDate;
  /** The first day with a counting session or a planned session; null: nothing yet. */
  readonly firstActivity: LocalDate | null;
  /** MOT-03 freestyle weekly target (settings); null: the registry default. */
  readonly weeklyTarget: number | null;
  /** A-07: one missed session per week still keeps the week. */
  readonly grace: boolean;
  readonly weekStartsOn: IsoWeekday;
  /** Break days of weeks that have no entry (a break in a week without sessions or a plan). */
  readonly breakDaysOf?: (weekStart: LocalDate) => number;
}

export const WEEK_STATES = ['kept', 'graced', 'missed', 'paused', 'pending'] as const;
export type WeekState = (typeof WEEK_STATES)[number];

export type TargetSource = 'plan' | 'freestyle' | 'default';

export interface StreakWeek {
  readonly weekStart: LocalDate;
  readonly state: WeekState;
  readonly done: number;
  /** Sessions the week asked for (0 when paused). */
  readonly target: number;
  readonly targetSource: TargetSource;
  readonly deload: boolean;
  readonly breakDays: number;
  /** The streak after this week. */
  readonly streak: number;
}

export interface Streak {
  readonly current: number;
  readonly best: number;
  /** The week the best streak ended in; null without a kept week. */
  readonly bestEndedWeek: LocalDate | null;
  /** Every week from the first activity to the current week, oldest first. */
  readonly weeks: readonly StreakWeek[];
  /** The current week (progress such as 2 of 4); null before any activity. */
  readonly thisWeek: StreakWeek | null;
}

/** MOT-03: whether a finished or partial session counts toward its week. */
export function countsForStreak(
  session: Pick<Session, 'status' | 'exercises'>,
  sets: readonly Pick<LoggedSet, 'state' | 'type'>[],
  rules: RuleSlice<'motivation.streak.partialMinShare'>,
): boolean {
  if (session.status === 'finished') return true;
  if (session.status !== 'partial') return false;
  const plannedWorking = session.exercises
    .filter((slot) => slot.origin !== 'added')
    .reduce((sum, slot) => sum + slot.sets.filter((set) => set.type !== 'warmup').length, 0);
  const doneWorking = sets.filter((set) => set.state === 'done' && set.type !== 'warmup').length;
  return (
    plannedWorking > 0 &&
    doneWorking >= plannedWorking * rules['motivation.streak.partialMinShare'].value
  );
}

const EMPTY_WEEK = { done: 0, planned: 0, onBreak: 0, deload: false, breakDays: 0 };

/** The weekly streak over every week from the first activity to the current one (MOT-03/04). */
export function computeStreak(input: StreakInput, rules: StreakRules): Explained<Streak> {
  const params = [
    rules['motivation.streak.graceSessions'],
    rules['motivation.streak.defaultWeeklyTarget'],
  ];
  if (input.firstActivity === null || input.firstActivity > addDays(input.currentWeek, 6)) {
    const empty: Streak = { current: 0, best: 0, bestEndedWeek: null, weeks: [], thisWeek: null };
    return explained(empty, 'streak.current', { args: { current: 0, best: 0, weeks: 0 }, params });
  }
  const byWeek = new Map<LocalDate, StreakWeekInput>();
  for (const week of input.weeks) {
    const key = weekStartOf(week.weekStart, input.weekStartsOn);
    const known = byWeek.get(key);
    byWeek.set(
      key,
      known
        ? {
            weekStart: key,
            done: known.done + week.done,
            planned: known.planned + week.planned,
            onBreak: known.onBreak + week.onBreak,
            deload: known.deload || week.deload,
            breakDays: Math.min(7, Math.max(known.breakDays, week.breakDays)),
          }
        : { ...week, weekStart: key },
    );
  }
  const firstWeek = weekStartOf(input.firstActivity, input.weekStartsOn);
  const weeks: StreakWeek[] = [];
  let current = 0;
  let best = 0;
  let bestEndedWeek: LocalDate | null = null;
  for (let week = firstWeek; week <= input.currentWeek; week = addDays(week, 7)) {
    const data = byWeek.get(week) ?? {
      weekStart: week,
      ...EMPTY_WEEK,
      breakDays: input.breakDaysOf?.(week) ?? 0,
    };
    const firstDays =
      week === firstWeek ? 7 - Math.max(0, daysBetween(week, input.firstActivity)) : 7;
    const evaluated = evaluateWeek(data, {
      isCurrent: week === input.currentWeek,
      isFirst: week === firstWeek,
      daysTracked: firstDays,
      weeklyTarget: input.weeklyTarget,
      grace: input.grace,
      rules,
    });
    if (evaluated.state === 'kept' || evaluated.state === 'graced') {
      current++;
      if (current > best) {
        best = current;
        bestEndedWeek = week;
      }
    } else if (evaluated.state === 'missed') {
      current = 0;
    }
    weeks.push({ ...evaluated, streak: current });
  }
  const value: Streak = { current, best, bestEndedWeek, weeks, thisWeek: weeks.at(-1) ?? null };
  return explained(value, 'streak.current', {
    args: {
      current,
      best,
      weeks: weeks.length,
      paused: weeks.filter((week) => week.state === 'paused').length,
      grace: input.grace,
    },
    params,
  });
}

interface WeekContext {
  readonly isCurrent: boolean;
  readonly isFirst: boolean;
  /** Days of the week from the first activity on (7 except in the first week). */
  readonly daysTracked: number;
  readonly weeklyTarget: number | null;
  readonly grace: boolean;
  readonly rules: StreakRules;
}

function evaluateWeek(week: StreakWeekInput, ctx: WeekContext): Omit<StreakWeek, 'streak'> {
  const freeDays = Math.max(0, Math.min(7 - week.breakDays, ctx.daysTracked));
  let target: number;
  let targetSource: TargetSource;
  if (week.planned + week.onBreak > 0) {
    target = week.planned;
    targetSource = 'plan';
  } else {
    const weekly = ctx.weeklyTarget ?? ctx.rules['motivation.streak.defaultWeeklyTarget'].value;
    // A partly covered week (break, the first week) asks for its share, rounded in the user's
    // favour; the first week asks for at least one session (its first activity), unless a break
    // covers all of it.
    const share = Math.floor((weekly * freeDays) / 7);
    target = ctx.isFirst && freeDays > 0 ? Math.max(1, share) : share;
    targetSource = ctx.weeklyTarget === null ? 'default' : 'freestyle';
  }
  const base = {
    weekStart: week.weekStart,
    done: week.done,
    deload: week.deload,
    breakDays: week.breakDays,
    targetSource,
  };
  if (week.breakDays >= 7 || target <= 0) {
    // A full break week, or no session asked for (all planned ones paused): paused.
    return { ...base, target: 0, state: 'paused' };
  }
  const grace = ctx.grace ? ctx.rules['motivation.streak.graceSessions'].value : 0;
  if (week.done >= target) return { ...base, target, state: 'kept' };
  if (grace > 0 && week.done >= 1 && week.done >= target - grace) {
    return { ...base, target, state: 'graced' };
  }
  return { ...base, target, state: ctx.isCurrent ? 'pending' : 'missed' };
}

/** The "Why?" of one week's state. */
export function explainWeek(week: StreakWeek): Explanation {
  return explain('streak.week', {
    args: {
      state: week.state,
      done: week.done,
      target: week.target,
      targetSource: week.targetSource,
      deload: week.deload,
      breakDays: week.breakDays,
    },
  });
}

/**
 * MOT-04: whether a past week may still be marked as a break (at most
 * `motivation.streak.retroactiveBreakWeeks` weeks back; the current week too).
 */
export function canMarkBreak(
  weekStart: LocalDate,
  currentWeek: LocalDate,
  rules: RuleSlice<'motivation.streak.retroactiveBreakWeeks'>,
): boolean {
  const weeksBack = daysBetween(weekStart, currentWeek) / 7;
  return (
    Number.isInteger(weeksBack) &&
    weeksBack >= 0 &&
    weeksBack <= rules['motivation.streak.retroactiveBreakWeeks'].value
  );
}

/** Days of a week (7 days from `weekStart`) inside any of the breaks. */
export function breakDaysIn(
  weekStart: LocalDate,
  breaks: readonly { readonly startDate: LocalDate; readonly endDate: LocalDate | null }[],
): number {
  let days = 0;
  for (let offset = 0; offset < 7; offset++) {
    const day = addDays(weekStart, offset);
    if (
      breaks.some(
        (entry) => day >= entry.startDate && (entry.endDate === null || day <= entry.endDate),
      )
    ) {
      days++;
    }
  }
  return days;
}

/** MOT-02/03 celebration data: what changed between two streaks (a newly kept week, a new best). */
export interface StreakChange {
  readonly kept: boolean;
  readonly current: number;
  readonly best: number;
  readonly newBest: boolean;
}

export function streakChange(before: Streak, after: Streak): StreakChange | null {
  if (after.current <= before.current) return null;
  return {
    kept: true,
    current: after.current,
    best: after.best,
    newBest: after.best > before.best,
  };
}
