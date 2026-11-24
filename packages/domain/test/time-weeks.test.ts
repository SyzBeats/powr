import { describe, expect, it } from 'vitest';

import { addDays, daysBetween, isoWeekKey, isoWeekOf, weekStartOf, type LocalDate } from '../src';

const day = (value: string) => value as LocalDate;

describe('calendar days and weeks (SET-11)', () => {
  it('adds days and counts the days between dates across month, year and DST boundaries', () => {
    expect(addDays(day('2026-02-27'), 2)).toBe('2026-03-01');
    expect(addDays(day('2026-01-01'), -1)).toBe('2025-12-31');
    expect(daysBetween(day('2026-03-28'), day('2026-03-30'))).toBe(2);
    expect(daysBetween(day('2026-11-24'), day('2026-11-20'))).toBe(-4);
  });

  it('finds the start of the week for any week start', () => {
    // 2026-11-24 is a Tuesday.
    expect(weekStartOf(day('2026-11-24'))).toBe('2026-11-23');
    expect(weekStartOf(day('2026-11-23'))).toBe('2026-11-23');
    expect(weekStartOf(day('2026-11-24'), 7)).toBe('2026-11-22');
    expect(weekStartOf(day('2026-11-22'), 7)).toBe('2026-11-22');
    expect(weekStartOf(day('2026-11-24'), 6)).toBe('2026-11-21');
  });

  it('gives ISO 8601 weeks, including weeks that belong to the neighbouring year', () => {
    expect(isoWeekOf(day('2026-11-24'))).toEqual({ year: 2026, week: 48 });
    expect(isoWeekKey(day('2026-11-24'))).toBe('2026-W48');
    expect(isoWeekKey(day('2027-01-01'))).toBe('2026-W53');
    expect(isoWeekKey(day('2024-12-30'))).toBe('2025-W01');
  });
});
