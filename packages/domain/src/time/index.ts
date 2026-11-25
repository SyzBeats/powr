/**
 * Time (§8.1, ADR-0015): instants with their offset and zone, calendar days as `LocalDate`, day
 * arithmetic and week boundaries. Temporal through the ponyfill; the domain never reads a clock.
 */
import { Temporal } from 'temporal-polyfill';

import type { LocalDate } from '../ids';

/** A moment, captured with the device's offset and IANA zone at that moment (§8.1). */
export interface InstantTz {
  readonly epochMs: number;
  readonly offsetMin: number;
  readonly zone: string;
}

/** Builds an InstantTz for a moment in a zone. The zone must be a valid IANA zone or offset. */
export function makeInstantTz(epochMs: number, zone: string): InstantTz {
  const zoned = Temporal.Instant.fromEpochMilliseconds(epochMs).toZonedDateTimeISO(zone);
  return { epochMs, offsetMin: zoned.offsetNanoseconds / 60_000_000_000, zone: zoned.timeZoneId };
}

/** The instant of a wall-clock time ('HH:MM') on a day in a zone (backdated logging, WKT-15). */
export function instantAt(date: LocalDate, time: string, zone: string): InstantTz {
  const zoned = Temporal.PlainDate.from(date).toZonedDateTime({
    timeZone: zone,
    plainTime: Temporal.PlainTime.from(time),
  });
  return {
    epochMs: zoned.epochMilliseconds,
    offsetMin: zoned.offsetNanoseconds / 60_000_000_000,
    zone: zoned.timeZoneId,
  };
}

/** The calendar day of an instant in the zone it was captured in. */
export function toLocalDate(instant: InstantTz): LocalDate {
  return Temporal.Instant.fromEpochMilliseconds(instant.epochMs)
    .toZonedDateTimeISO(zoneOf(instant))
    .toPlainDate()
    .toString() as LocalDate;
}

/** The local hour (0–23) of an instant in the zone it was captured in. */
export function localHourOf(instant: InstantTz): number {
  return Temporal.Instant.fromEpochMilliseconds(instant.epochMs).toZonedDateTimeISO(zoneOf(instant))
    .hour;
}

/** ISO 8601 with offset, e.g. "2026-11-23T18:04:11.123+01:00". */
export function toIsoWithOffset(instant: InstantTz): string {
  return Temporal.Instant.fromEpochMilliseconds(instant.epochMs)
    .toZonedDateTimeISO(zoneOf(instant))
    .toString({ timeZoneName: 'never', smallestUnit: 'millisecond' });
}

export function isLocalDate(value: string): value is LocalDate {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  try {
    Temporal.PlainDate.from(value, { overflow: 'reject' });
    return true;
  } catch {
    return false;
  }
}

/** Falls back to the stored offset if the zone is unknown to the running Temporal implementation. */
function zoneOf(instant: InstantTz): string {
  try {
    Temporal.Instant.fromEpochMilliseconds(0).toZonedDateTimeISO(instant.zone);
    return instant.zone;
  } catch {
    return formatOffset(instant.offsetMin);
  }
}

function formatOffset(offsetMin: number): string {
  const sign = offsetMin < 0 ? '-' : '+';
  const abs = Math.abs(offsetMin);
  const hours = String(Math.floor(abs / 60)).padStart(2, '0');
  const minutes = String(abs % 60).padStart(2, '0');
  return `${sign}${hours}:${minutes}`;
}

/** ISO weekday: 1 = Monday … 7 = Sunday (Temporal's `dayOfWeek`). */
export type IsoWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;

/*
 * Day arithmetic on 'YYYY-MM-DD' strings with the proleptic Gregorian calendar (Hinnant's
 * days-from-civil), the same results as Temporal.PlainDate for every valid `LocalDate`
 * (property-tested), without parsing a Temporal object per call: the M4a analytics rebuild calls
 * these hundreds of thousands of times for a five-year history.
 */

/** Days since 1970-01-01 (negative before). */
export function epochDay(date: LocalDate): number {
  let year = Number(date.slice(0, 4));
  const month = Number(date.slice(5, 7));
  const day = Number(date.slice(8, 10));
  year -= month <= 2 ? 1 : 0;
  const era = Math.floor(year / 400);
  const yearOfEra = year - era * 400;
  const dayOfYear = Math.floor((153 * ((month + 9) % 12) + 2) / 5) + day - 1;
  const dayOfEra =
    yearOfEra * 365 + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100) + dayOfYear;
  return era * 146_097 + dayOfEra - 719_468;
}

/** The calendar day `days` days after 1970-01-01 (inverse of `epochDay`). */
export function fromEpochDay(days: number): LocalDate {
  const shifted = days + 719_468;
  const era = Math.floor(shifted / 146_097);
  const dayOfEra = shifted - era * 146_097;
  const yearOfEra = Math.floor(
    (dayOfEra -
      Math.floor(dayOfEra / 1460) +
      Math.floor(dayOfEra / 36_524) -
      Math.floor(dayOfEra / 146_096)) /
      365,
  );
  const dayOfYear =
    dayOfEra - (365 * yearOfEra + Math.floor(yearOfEra / 4) - Math.floor(yearOfEra / 100));
  const monthIndex = Math.floor((5 * dayOfYear + 2) / 153);
  const day = dayOfYear - Math.floor((153 * monthIndex + 2) / 5) + 1;
  const month = monthIndex < 10 ? monthIndex + 3 : monthIndex - 9;
  const year = yearOfEra + era * 400 + (month <= 2 ? 1 : 0);
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}` as LocalDate;
}

/** ISO weekday of a day (1 = Monday … 7 = Sunday). */
export function weekdayOf(date: LocalDate): IsoWeekday {
  // 1970-01-01 was a Thursday (ISO 4).
  return (((((epochDay(date) + 3) % 7) + 7) % 7) + 1) as IsoWeekday;
}

/** The calendar day `days` after `date` (negative: before). */
export function addDays(date: LocalDate, days: number): LocalDate {
  return fromEpochDay(epochDay(date) + days);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetween(from: LocalDate, to: LocalDate): number {
  return epochDay(to) - epochDay(from);
}

/** The first day of the week that contains `date`, for the user's week start (SET-11). */
export function weekStartOf(date: LocalDate, weekStartsOn: IsoWeekday = 1): LocalDate {
  const offset = (weekdayOf(date) - weekStartsOn + 7) % 7;
  return addDays(date, -offset);
}

/** ISO 8601 week (Monday start), e.g. 2026-11-24 → { year: 2026, week: 48 }. */
export function isoWeekOf(date: LocalDate): { readonly year: number; readonly week: number } {
  const day = Temporal.PlainDate.from(date);
  // Defined for the ISO 8601 calendar, which PlainDate.from uses for 'YYYY-MM-DD' strings.
  return { year: day.yearOfWeek ?? day.year, week: day.weekOfYear ?? 1 };
}

/** ISO week key such as "2026-W48". */
export function isoWeekKey(date: LocalDate): string {
  const { year, week } = isoWeekOf(date);
  return `${year}-W${String(week).padStart(2, '0')}`;
}
