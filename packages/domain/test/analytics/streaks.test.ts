import * as fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { addDays, type LocalDate } from '../../src';
import {
  breakDaysIn,
  canMarkBreak,
  computeStreak,
  countsForStreak,
  streakChange,
  type StreakInput,
  type StreakWeekInput,
} from '../../src/streaks';
import { rules } from '../fixtures/rules';

/** Test environment (no Node types in this project). */
const env =
  (globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env ?? {};

/*
 * MOT-03/04: the weekly streak and its fairness rules. Reference cases for each rule, then
 * fast-check invariants: more training never lowers a streak, a break never lowers it, the best
 * never falls below the current, a missed past week resets only the current one, the current week
 * never breaks it, and the order of the inputs does not matter.
 */

const RULES = rules();
const W0 = '2026-09-07' as LocalDate; // a Monday
const week = (n: number) => addDays(W0, 7 * n);

function entry(n: number, done: number, planned: number, extra: Partial<StreakWeekInput> = {}) {
  return { weekStart: week(n), done, planned, onBreak: 0, deload: false, breakDays: 0, ...extra };
}

function streakOf(weeks: StreakWeekInput[], extra: Partial<StreakInput> = {}) {
  return computeStreak(
    {
      weeks,
      currentWeek: week(weeks.length),
      firstActivity: W0,
      weeklyTarget: null,
      grace: false,
      weekStartsOn: 1,
      ...extra,
    },
    RULES,
  ).value;
}

const done = (n: number) =>
  Array.from({ length: 4 }, (_, i) => ({
    state: i < n ? ('done' as const) : ('skipped' as const),
    type: 'working' as const,
  }));

describe('weekly streak (MOT-03)', () => {
  it('counts consecutive kept weeks; a missed week resets the current streak, never the best', () => {
    const streak = streakOf([entry(0, 3, 3), entry(1, 4, 3), entry(2, 1, 3), entry(3, 3, 3)]);
    expect(streak.weeks.map((w) => w.state)).toEqual(['kept', 'kept', 'missed', 'kept', 'pending']);
    expect(streak.current).toBe(1);
    expect(streak.best).toBe(2);
    expect(streak.bestEndedWeek).toBe(week(1));
  });

  it('counts sessions on unscheduled days and deload weeks with their planned sessions', () => {
    const streak = streakOf([entry(0, 4, 3), entry(1, 2, 2, { deload: true })]);
    expect(streak.weeks.slice(0, 2).map((w) => [w.state, w.deload])).toEqual([
      ['kept', false],
      ['kept', true],
    ]);
    expect(streak.current).toBe(2);
  });

  it('keeps a week one session short with the grace (A-07), never a week without a session', () => {
    const weeks = [entry(0, 2, 3), entry(1, 0, 1)];
    expect(
      streakOf(weeks)
        .weeks.map((w) => w.state)
        .slice(0, 2),
    ).toEqual(['missed', 'missed']);
    const graced = streakOf(weeks, { grace: true });
    expect(graced.weeks.map((w) => w.state).slice(0, 2)).toEqual(['graced', 'missed']);
  });

  it('shows the current week as pending until it is kept, then counts it (2 of 4, MOT-03)', () => {
    const pending = streakOf([entry(0, 3, 3), entry(1, 2, 4)], { currentWeek: week(1) });
    expect(pending.thisWeek).toMatchObject({ state: 'pending', done: 2, target: 4 });
    expect(pending.current).toBe(1);
    const kept = streakOf([entry(0, 3, 3), entry(1, 4, 4)], { currentWeek: week(1) });
    expect(kept.current).toBe(2);
  });

  it('uses the freestyle weekly target without plan sessions, one session by default', () => {
    const weeks = [entry(0, 2, 0), entry(1, 1, 0)];
    expect(
      streakOf(weeks)
        .weeks.slice(0, 2)
        .map((w) => w.state),
    ).toEqual(['kept', 'kept']);
    const target = streakOf(weeks, { weeklyTarget: 2 });
    expect(target.weeks.slice(0, 2).map((w) => [w.state, w.targetSource])).toEqual([
      ['kept', 'freestyle'],
      ['missed', 'freestyle'],
    ]);
  });

  it('counts a partial session with at least half of its planned working sets (MOT-03)', () => {
    const slot = {
      origin: 'plan' as const,
      sets: [1, 2, 3, 4].map(() => ({ type: 'working' as const })),
    };
    const partial = { status: 'partial' as const, exercises: [slot] } as never;
    expect(countsForStreak(partial, done(2), RULES)).toBe(true);
    expect(countsForStreak(partial, done(1), RULES)).toBe(false);
    expect(countsForStreak({ status: 'finished', exercises: [] } as never, [], RULES)).toBe(true);
    expect(
      countsForStreak({ status: 'discarded', exercises: [slot] } as never, done(4), RULES),
    ).toBe(false);
  });
});

describe('streak fairness (MOT-04)', () => {
  it('pauses for a break week: it neither keeps nor breaks the streak', () => {
    const streak = streakOf([
      entry(0, 3, 3),
      entry(1, 0, 0, { onBreak: 3, breakDays: 7 }),
      entry(2, 3, 3),
    ]);
    expect(streak.weeks.map((w) => w.state).slice(0, 3)).toEqual(['kept', 'paused', 'kept']);
    expect(streak.current).toBe(2);
  });

  it('asks a partly covered week only for the sessions outside the break', () => {
    // Plan: two of four sessions paused by an illness break; the other two were done.
    const plan = streakOf([entry(0, 2, 2, { onBreak: 2, breakDays: 4 })]);
    expect(plan.weeks[0]).toMatchObject({ state: 'kept', target: 2 });
    // Freestyle target 3, a 4-day break: floor(3 × 3/7) = 1 session.
    const free = streakOf([entry(0, 1, 0, { breakDays: 4 })], { weeklyTarget: 3 });
    expect(free.weeks[0]).toMatchObject({ state: 'kept', target: 1 });
  });

  it('pauses an empty week a break covers (retroactive break without sessions)', () => {
    const streak = streakOf([entry(0, 1, 0)], {
      currentWeek: week(2),
      breakDaysOf: (start) => (start === week(1) ? 7 : 0),
    });
    expect(streak.weeks.map((w) => w.state)).toEqual(['kept', 'paused', 'pending']);
    expect(streak.current).toBe(1);
  });

  it('asks the first week only for its share from the first activity on', () => {
    // Started on Friday with a target of 3: 3 of 7 days → floor(3 × 3/7) = 1.
    const streak = streakOf([entry(0, 1, 0)], { weeklyTarget: 3, firstActivity: addDays(W0, 4) });
    expect(streak.weeks[0]).toMatchObject({ state: 'kept', target: 1 });
  });

  it('marks breaks at most four weeks back (MOT-04)', () => {
    expect(canMarkBreak(week(0), week(4), RULES)).toBe(true);
    expect(canMarkBreak(week(0), week(5), RULES)).toBe(false);
    expect(canMarkBreak(week(5), week(5), RULES)).toBe(true);
    expect(canMarkBreak(addDays(week(4), 1), week(5), RULES)).toBe(false);
  });

  it('counts break days inside a week, open breaks included', () => {
    expect(breakDaysIn(week(0), [{ startDate: addDays(week(0), 3), endDate: null }])).toBe(4);
    expect(
      breakDaysIn(week(0), [{ startDate: addDays(week(0), -3), endDate: addDays(week(0), 1) }]),
    ).toBe(2);
  });

  it('reports a newly kept week and a new best (celebration data, MOT-02)', () => {
    const before = streakOf([entry(0, 3, 3), entry(1, 2, 3)], { currentWeek: week(1) });
    const after = streakOf([entry(0, 3, 3), entry(1, 3, 3)], { currentWeek: week(1) });
    expect(streakChange(before, after)).toEqual({ kept: true, current: 2, best: 2, newBest: true });
    expect(streakChange(after, after)).toBeNull();
  });
});

// --- Properties ------------------------------------------------------------------------------

const weekArb = fc.record({
  done: fc.integer({ min: 0, max: 6 }),
  planned: fc.integer({ min: 0, max: 5 }),
  onBreak: fc.integer({ min: 0, max: 2 }),
  deload: fc.boolean(),
  breakDays: fc.constantFrom(0, 0, 0, 3, 7),
});

const historyArb = fc.record({
  weeks: fc.array(weekArb, { minLength: 1, maxLength: 20 }),
  grace: fc.boolean(),
  weeklyTarget: fc.option(fc.integer({ min: 1, max: 5 }), { nil: null }),
});

type ValueOf<A> = A extends fc.Arbitrary<infer T> ? T : never;

function inputOf(history: ValueOf<typeof historyArb>): StreakInput {
  return {
    weeks: history.weeks.map((w, n) => ({ weekStart: week(n), ...w })),
    currentWeek: week(history.weeks.length - 1),
    firstActivity: W0,
    weeklyTarget: history.weeklyTarget,
    grace: history.grace,
    weekStartsOn: 1,
  };
}

const runs = (n: number) => ({ numRuns: env['CI'] ? n : n * 2 });

describe('streak fairness invariants (fast-check)', () => {
  it('best ≥ current, and the current streak counts the kept weeks since the last missed one', () => {
    fc.assert(
      fc.property(historyArb, (history) => {
        const streak = computeStreak(inputOf(history), RULES).value;
        expect(streak.best).toBeGreaterThanOrEqual(streak.current);
        const lastMissed = streak.weeks.findLastIndex((w) => w.state === 'missed');
        const kept = streak.weeks
          .slice(lastMissed + 1)
          .filter((w) => w.state === 'kept' || w.state === 'graced').length;
        expect(streak.current).toBe(kept);
        expect(
          streak.weeks.every((w, i) => i === streak.weeks.length - 1 || w.state !== 'pending'),
        ).toBe(true);
      }),
      runs(300),
    );
  });

  it('one more completed session in any week never lowers the current or the best streak', () => {
    fc.assert(
      fc.property(historyArb, fc.nat(), (history, pick) => {
        const input = inputOf(history);
        const index = pick % input.weeks.length;
        const more = {
          ...input,
          weeks: input.weeks.map((w, i) => (i === index ? { ...w, done: w.done + 1 } : w)),
        };
        const before = computeStreak(input, RULES).value;
        const after = computeStreak(more, RULES).value;
        expect(after.current).toBeGreaterThanOrEqual(before.current);
        expect(after.best).toBeGreaterThanOrEqual(before.best);
      }),
      runs(300),
    );
  });

  it('marking a missed or pending week as a break never lowers the current or the best streak', () => {
    fc.assert(
      fc.property(historyArb, fc.nat(), (history, pick) => {
        const input = inputOf(history);
        const index = pick % input.weeks.length;
        const state = computeStreak(input, RULES).value.weeks[index]!.state;
        fc.pre(state === 'missed' || state === 'pending');
        const paused = {
          ...input,
          weeks: input.weeks.map((w, i) =>
            i === index ? { ...w, breakDays: 7, onBreak: w.onBreak + w.planned, planned: 0 } : w,
          ),
        };
        const before = computeStreak(input, RULES).value;
        const after = computeStreak(paused, RULES).value;
        expect(after.weeks[index]!.state).toBe('paused');
        expect(after.current).toBeGreaterThanOrEqual(before.current);
        expect(after.best).toBeGreaterThanOrEqual(before.best);
      }),
      runs(300),
    );
  });

  it('turning the grace on never lowers a streak; the current week never breaks it', () => {
    fc.assert(
      fc.property(historyArb, (history) => {
        const input = inputOf(history);
        const off = computeStreak({ ...input, grace: false }, RULES).value;
        const on = computeStreak({ ...input, grace: true }, RULES).value;
        expect(on.current).toBeGreaterThanOrEqual(off.current);
        expect(on.best).toBeGreaterThanOrEqual(off.best);
        expect(off.thisWeek?.state).not.toBe('missed');
      }),
      runs(300),
    );
  });

  it('does not depend on the order of the weeks it is given', () => {
    fc.assert(
      fc.property(historyArb, fc.nat(), (history, seed) => {
        const input = inputOf(history);
        const shuffled = input.weeks.toSorted(
          (a, b) =>
            ((Number(a.weekStart.slice(8)) * 31 + seed) % 7) -
            ((Number(b.weekStart.slice(8)) * 31 + seed) % 7),
        );
        expect(computeStreak({ ...input, weeks: shuffled }, RULES).value).toEqual(
          computeStreak(input, RULES).value,
        );
      }),
      runs(200),
    );
  });
});
