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

/** The calendar day of an instant in the zone it was captured in. */
export function toLocalDate(instant: InstantTz): LocalDate {
  return Temporal.Instant.fromEpochMilliseconds(instant.epochMs)
    .toZonedDateTimeISO(zoneOf(instant))
    .toPlainDate()
    .toString() as LocalDate;
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
