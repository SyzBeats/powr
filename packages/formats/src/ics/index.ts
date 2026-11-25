// `@powr/formats/ics`: the iCalendar (RFC 5545) serializer for the calendar export (CAL-01…05,
// technical concept §6.6, §8.13). Pure and dependency-free apart from the domain's day helpers:
// no Zod, no fflate, no I/O. The application converts each planned session's local wall-clock
// start to an instant in the device zone (so DST is right per event, CAL-03) and passes epoch
// milliseconds; this module only writes text.
import { addDays, isLocalDate, type LocalDate } from '@powr/domain';

export const ICS_MIME = 'text/calendar';

/**
 * When an event starts. A timed event is written in UTC (`DTSTART:20261124T170000Z`) with a
 * `DURATION`; an all-day event as `DTSTART;VALUE=DATE` with an exclusive `DTEND;VALUE=DATE` on
 * the next day (RFC 5545 §3.6.1).
 */
export type IcsStart =
  | { readonly kind: 'dateTime'; readonly epochMs: number; readonly durationMinutes: number }
  | { readonly kind: 'date'; readonly date: string };

/** A display reminder (`VALARM`, `ACTION:DISPLAY`) this many minutes before the start. */
export interface IcsAlarm {
  readonly minutesBefore: number;
  readonly description: string;
}

export interface IcsEvent {
  readonly uid: string;
  /** Non-negative integer; a higher value tells calendar apps that the event changed (CAL-04). */
  readonly sequence: number;
  readonly status: 'CONFIRMED' | 'CANCELLED';
  readonly start: IcsStart;
  readonly summary: string;
  readonly description?: string;
  /** Ignored for cancelled events: a cancelled event never reminds. */
  readonly alarm?: IcsAlarm;
}

export interface IcsCalendar {
  /** For example `-//SZ WEB DEVELOPMENT//POWR 0.0.0//EN`. */
  readonly prodId: string;
  /** Optional calendar name (`X-WR-CALNAME`), shown by some apps when importing. */
  readonly name?: string;
  /** `DTSTAMP` of every event: when the file was made, written in UTC. */
  readonly dtStampEpochMs: number;
  /** At least one: RFC 5545 requires a component in every calendar object. */
  readonly events: readonly IcsEvent[];
}

const CRLF = '\r\n';
/** RFC 5545 §3.1: content lines should not be longer than 75 octets, excluding the line break. */
const MAX_LINE_OCTETS = 75;

/**
 * Builds the whole `.ics` text: CRLF line endings, long lines folded at 75 octets, text values
 * escaped, ending with CRLF. Deterministic: the same input gives the same bytes. Throws on input
 * the caller should never build (non-finite times, negative sequences, bad dates, no events).
 */
export function encodeIcs(calendar: IcsCalendar): string {
  if (calendar.events.length === 0) {
    throw new Error('An iCalendar file needs at least one event (RFC 5545 §3.6)');
  }
  const stamp = utcDateTime(calendar.dtStampEpochMs, 'dtStampEpochMs');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${escapeIcsText(requireText(calendar.prodId, 'prodId'))}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ];
  if (calendar.name !== undefined) lines.push(`X-WR-CALNAME:${escapeIcsText(calendar.name)}`);
  for (const event of calendar.events) lines.push(...eventLines(event, stamp));
  lines.push('END:VCALENDAR');
  return lines.map((line) => foldIcsLine(line) + CRLF).join('');
}

function eventLines(event: IcsEvent, stamp: string): string[] {
  if (event.status !== 'CONFIRMED' && event.status !== 'CANCELLED') {
    throw new Error(`Unknown event status: ${String(event.status)}`);
  }
  const lines = [
    'BEGIN:VEVENT',
    `UID:${escapeIcsText(requireText(event.uid, 'uid'))}`,
    `DTSTAMP:${stamp}`,
    ...startLines(event.start),
    `SUMMARY:${escapeIcsText(event.summary)}`,
  ];
  if (event.description !== undefined) {
    lines.push(`DESCRIPTION:${escapeIcsText(event.description)}`);
  }
  lines.push(
    `SEQUENCE:${nonNegativeInteger(event.sequence, 'sequence')}`,
    `STATUS:${event.status}`,
  );
  if (event.alarm && event.status === 'CONFIRMED') lines.push(...alarmLines(event.alarm));
  lines.push('END:VEVENT');
  return lines;
}

function startLines(start: IcsStart): string[] {
  if (start.kind === 'dateTime') {
    const minutes = start.durationMinutes;
    if (!Number.isInteger(minutes) || minutes < 1) {
      throw new Error(`durationMinutes must be a positive whole number, got ${minutes}`);
    }
    return [
      `DTSTART:${utcDateTime(start.epochMs, 'start.epochMs')}`,
      `DURATION:${duration(minutes)}`,
    ];
  }
  if (start.kind === 'date') {
    if (!isLocalDate(start.date)) {
      throw new Error(`start.date must be a valid 'YYYY-MM-DD' day, got '${start.date}'`);
    }
    const day = start.date;
    const end = addDays(day, 1);
    if (!isLocalDate(end)) throw new Error(`start.date is the last day iCalendar can write`);
    return [`DTSTART;VALUE=DATE:${basicDate(day)}`, `DTEND;VALUE=DATE:${basicDate(end)}`];
  }
  throw new Error(`Unknown start kind: ${String((start as { kind?: unknown }).kind)}`);
}

function alarmLines(alarm: IcsAlarm): string[] {
  const minutes = nonNegativeInteger(alarm.minutesBefore, 'alarm.minutesBefore');
  return [
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    `TRIGGER:${minutes === 0 ? 'PT0M' : `-${duration(minutes)}`}`,
    `DESCRIPTION:${escapeIcsText(requireText(alarm.description, 'alarm.description'))}`,
    'END:VALARM',
  ];
}

/**
 * A stable event UID, `<id>@<host>` (CAL-04, product-owner decision 2026-11-25: the host is the
 * one configured public host, `powr.invalid` by default). Throws when either part is empty or
 * holds an `@`, whitespace or a control character, so a UID never needs escaping or folding
 * surprises in the calendar app.
 */
export function icsUid(id: string, host: string): string {
  for (const [name, part] of [
    ['id', id],
    ['host', host],
  ] as const) {
    if (part.length === 0) throw new Error(`The UID ${name} is empty`);
    // oxlint-disable-next-line no-control-regex -- control characters are what this rejects
    if (/[@\s\u0000-\u001f\u007f]/u.test(part)) {
      throw new Error(`The UID ${name} must not contain '@', whitespace or control characters`);
    }
  }
  return `${id}@${host}`;
}

/**
 * Escapes a TEXT value (RFC 5545 §3.3.11): backslash, semicolon and comma get a backslash, every
 * line break (CRLF, LF or CR) becomes `\n`. Other control characters are not allowed in TEXT and
 * are dropped; a tab is kept.
 */
export function escapeIcsText(text: string): string {
  return (
    text
      .replaceAll('\\', '\\\\')
      .replaceAll(';', '\\;')
      .replaceAll(',', '\\,')
      .replaceAll(/\r\n|\n|\r/gu, '\\n')
      // oxlint-disable-next-line no-control-regex -- control characters are what this drops
      .replaceAll(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/gu, '')
  );
}

/**
 * Folds one content line (RFC 5545 §3.1): no physical line is longer than 75 octets of UTF-8;
 * each continuation starts with one space (which counts). Breaks fall between code points, so a
 * UTF-8 sequence or a surrogate pair is never split. Returns the line without a final CRLF.
 */
export function foldIcsLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let octets = 0;
  let limit = MAX_LINE_OCTETS;
  for (const char of line) {
    const size = utf8Octets(char.codePointAt(0) ?? 0);
    if (octets + size > limit) {
      parts.push(current);
      current = '';
      octets = 0;
      // Continuation lines start with a space, which takes one of the 75 octets.
      limit = MAX_LINE_OCTETS - 1;
    }
    current += char;
    octets += size;
  }
  parts.push(current);
  return parts.join(`${CRLF} `);
}

/** Octets of one code point in UTF-8; a lone surrogate is written as U+FFFD (3 octets). */
function utf8Octets(codePoint: number): number {
  if (codePoint < 0x80) return 1;
  if (codePoint < 0x800) return 2;
  if (codePoint < 0x1_00_00) return 3;
  return 4;
}

/** `20261124T170000Z`; milliseconds are dropped (iCalendar times have whole seconds). */
function utcDateTime(epochMs: number, name: string): string {
  if (!Number.isFinite(epochMs)) throw new Error(`${name} must be a finite number, got ${epochMs}`);
  const date = new Date(Math.floor(epochMs / 1000) * 1000);
  const iso = Number.isNaN(date.getTime()) ? '' : date.toISOString();
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})\.000Z$/u.exec(iso);
  if (!match) throw new Error(`${name} is outside the years 0000–9999, got ${epochMs}`);
  const [, year, month, day, hour, minute, second] = match;
  return `${year}${month}${day}T${hour}${minute}${second}Z`;
}

/** `20261124` from `2026-11-24`. */
function basicDate(date: LocalDate): string {
  return date.replaceAll('-', '');
}

/** `PT45M`, `PT1H`, `PT1H15M`, `PT2H` (RFC 5545 §3.3.6). */
function duration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `PT${rest}M`;
  return rest === 0 ? `PT${hours}H` : `PT${hours}H${rest}M`;
}

function nonNegativeInteger(value: number, name: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${name} must be a non-negative whole number, got ${value}`);
  }
  return value;
}

/** Text that still says something once escaped (control characters are dropped). */
function requireText(value: string, name: string): string {
  if (escapeIcsText(value).trim().length === 0) throw new Error(`${name} must not be empty`);
  return value;
}
