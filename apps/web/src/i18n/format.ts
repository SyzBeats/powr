/**
 * Locale-aware formatting (§8.15): numbers and dates follow the device locale while the UI
 * language stays English (NFR-L10N-01). Units belong in messages, never concatenated here.
 */
const deviceLocale = (): string => navigator.languages[0] ?? navigator.language ?? 'en';

export function formatNumber(value: number, maximumFractionDigits = 1): string {
  return new Intl.NumberFormat(deviceLocale(), { maximumFractionDigits }).format(value);
}

export function formatDateTime(epochMs: number): string {
  return new Intl.DateTimeFormat(deviceLocale(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(epochMs);
}

export function formatTime(epochMs: number): string {
  return new Intl.DateTimeFormat(deviceLocale(), { timeStyle: 'short' }).format(epochMs);
}

export function formatBytes(bytes: number): string {
  const units = ['byte', 'kilobyte', 'megabyte', 'gigabyte'] as const;
  let value = bytes;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1000;
    unit++;
  }
  return new Intl.NumberFormat(deviceLocale(), {
    style: 'unit',
    unit: units[unit],
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
}

/*
 * Calendar days (`LocalDate`, 'YYYY-MM-DD') without Temporal: the screens only format and step
 * through days, and the Temporal polyfill stays in the engine's lazy chunks (§8.19).
 */
export type IsoDay = `${number}-${number}-${number}`;
export type IsoWeekdayNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7;

function utcDate(localDate: string): Date {
  const [year = 1970, month = 1, day = 1] = localDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
}

function fromUtc(date: Date): IsoDay {
  return date.toISOString().slice(0, 10) as IsoDay;
}

/** Today on the device's calendar. */
export function todayLocal(now: Date = new Date()): IsoDay {
  return fromUtc(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
}

export function addLocalDays(localDate: string, days: number): IsoDay {
  const date = utcDate(localDate);
  date.setUTCDate(date.getUTCDate() + days);
  return fromUtc(date);
}

/** Whole days from `from` to `to` (negative when `to` is earlier). */
export function daysBetweenLocal(from: string, to: string): number {
  return Math.round((utcDate(to).getTime() - utcDate(from).getTime()) / 86_400_000);
}

/** ISO weekday (1 = Monday … 7 = Sunday) of a calendar day. */
function isoWeekday(localDate: string): IsoWeekdayNumber {
  return (((utcDate(localDate).getUTCDay() + 6) % 7) + 1) as IsoWeekdayNumber;
}

/** The first day of the week that contains `localDate`, for weeks starting on `weekStart`. */
export function weekStartOfLocal(localDate: string, weekStart: number): IsoDay {
  return addLocalDays(localDate, -((isoWeekday(localDate) - weekStart + 7) % 7));
}

export function formatLocalDate(
  localDate: string,
  style: 'long' | 'medium' | 'short' = 'medium',
): string {
  const options: Intl.DateTimeFormatOptions =
    style === 'long'
      ? { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }
      : style === 'medium'
        ? { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' }
        : { day: 'numeric', month: 'short', timeZone: 'UTC' };
  return new Intl.DateTimeFormat(deviceLocale(), options).format(utcDate(localDate));
}

/** Weekday name of an ISO weekday (1 = Monday) in the device locale. */
export function formatWeekday(isoDay: number, style: 'long' | 'short' = 'long'): string {
  // 2024-01-01 was a Monday.
  return new Intl.DateTimeFormat(deviceLocale(), { weekday: style, timeZone: 'UTC' }).format(
    utcDate(addLocalDays('2024-01-01', isoDay - 1)),
  );
}

/**
 * The locale's first day of the week (SET-11, NFR-L10N-01) as an ISO weekday:
 * `Intl.Locale#getWeekInfo()` (Chrome 130+), the older `weekInfo` getter, else Monday.
 */
export function localeWeekStart(locale: string = deviceLocale()): IsoWeekdayNumber {
  try {
    const intlLocale = new Intl.Locale(locale) as Intl.Locale & {
      getWeekInfo?: () => { firstDay: number };
      weekInfo?: { firstDay: number };
    };
    const firstDay = intlLocale.getWeekInfo?.().firstDay ?? intlLocale.weekInfo?.firstDay;
    if (firstDay !== undefined && firstDay >= 1 && firstDay <= 7)
      return firstDay as IsoWeekdayNumber;
  } catch {
    // An unknown locale tag: fall back to Monday.
  }
  return 1;
}

/** "45 min", "1 hr, 15 min" in the device locale. */
export function formatMinutes(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  const unit = (value: number, name: 'hour' | 'minute') =>
    new Intl.NumberFormat(deviceLocale(), {
      style: 'unit',
      unit: name,
      unitDisplay: 'short',
    }).format(value);
  if (hours === 0) return unit(rest, 'minute');
  if (rest === 0) return unit(hours, 'hour');
  return new Intl.ListFormat(deviceLocale(), { style: 'narrow', type: 'unit' }).format([
    unit(hours, 'hour'),
    unit(rest, 'minute'),
  ]);
}

/** A mass with its unit, e.g. "102.5 kg" (units are never concatenated in messages). */
export function formatMass(value: number, unit: 'kg' | 'lb'): string {
  return new Intl.NumberFormat(deviceLocale(), {
    style: 'unit',
    unit: unit === 'kg' ? 'kilogram' : 'pound',
    unitDisplay: 'short',
    maximumFractionDigits: 2,
  }).format(value);
}
