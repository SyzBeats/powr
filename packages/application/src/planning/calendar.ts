import {
  addDays,
  instantAt,
  toIsoWithOffset,
  weekStartOf,
  weekdayOf,
  type LocalDate,
  type MeetInfo,
  type Plan,
  type PlanDay,
  type PlannedSession,
  type PlannedSessionId,
} from '@powr/domain';
import { dayMinutes, setsOf } from '@powr/domain/planning';
import { encodeIcs, icsUid, type IcsEvent, type IcsStart } from '@powr/formats/ics';

import type { Deps } from '../deps';
import type { Repositories } from '../ports';
import { err, ok, type Result } from '../result';
import { exerciseLookup, today, userOverrides } from './context';
import { currentMesocycle } from './plan';

/**
 * Calendar export (CAL-01…05, §6.6, §8.13): the planned sessions of a range as an iCalendar
 * file. Times are the user's wall-clock times in the device zone, written as UTC instants per
 * event, so every event keeps its local time across a DST change (CAL-03). Each planned session
 * has a stable UID from its ID and the configured host (product-owner decision 2026-11-25); a
 * re-export updates what changed (higher SEQUENCE) and cancels exported sessions that are gone
 * (STATUS:CANCELLED), so calendar apps that honour UIDs update instead of duplicating (CAL-04).
 */

export type CalendarRange =
  | { readonly kind: 'restOfWeek' }
  | { readonly kind: 'block' }
  | { readonly kind: 'weeks'; readonly weeks: number }
  | { readonly kind: 'untilMeet' };

export type CalendarTime =
  /** The plan's start time per weekday (ONB-05), else `fallback` ('HH:MM') or all-day (null). */
  | { readonly kind: 'planned'; readonly fallback: string | null }
  | { readonly kind: 'fixed'; readonly time: string }
  | { readonly kind: 'allDay' };

/** The reminder choices of CAL-02 (minutes before; 0 = none). */
export const CALENDAR_ALARMS = [0, 15, 30, 60, 120] as const;
export type CalendarAlarm = (typeof CALENDAR_ALARMS)[number];

/** English event texts come from the app (Lingui); the use case stays language-free. */
export interface CalendarTexts {
  readonly title: (input: {
    readonly name: string;
    readonly week: number;
    readonly deload: boolean;
  }) => string;
  readonly description: (input: {
    readonly exercises: readonly { readonly name: string; readonly sets: number }[];
    readonly minutes: number;
  }) => string;
  readonly alarm: (input: { readonly title: string; readonly minutes: number }) => string;
}

export interface CalendarExportOptions {
  readonly range: CalendarRange;
  readonly time: CalendarTime;
  readonly alarmMinutes: CalendarAlarm;
  /** The UID host: the configured public host (`powr.invalid` until the deploy sets it). */
  readonly host: string;
  readonly texts: CalendarTexts;
}

export type CalendarExportError =
  | { readonly kind: 'noPlan' }
  | { readonly kind: 'noMeet' }
  | { readonly kind: 'nothingToExport' };

/** What an export would contain (the screen's summary before the file is made). */
export interface CalendarPreview {
  readonly from: LocalDate;
  readonly to: LocalDate;
  /** Planned sessions in the range. */
  readonly sessions: number;
  /** Earlier exported sessions outside the range that changed and are updated too. */
  readonly updates: number;
  /** Earlier exported sessions that are gone and are cancelled in the calendar. */
  readonly cancelled: number;
  /** Sessions without a start time for their weekday (they use the fallback). */
  readonly withoutTime: number;
  readonly first: LocalDate | null;
  readonly last: LocalDate | null;
}

export interface CalendarFile extends CalendarPreview {
  readonly fileName: string;
  readonly text: string;
  /** Recorded with {@link recordCalendarExport} once the file was delivered. */
  readonly record: CalendarExportRecord;
}

/** `meta.calendarExport`: what was exported, for SEQUENCE, cancellations and "plan changed". */
export const CALENDAR_EXPORT_KEY = 'calendarExport';

export interface CalendarExportRecord {
  /** ISO 8601 with offset. */
  readonly at: string;
  readonly host: string;
  readonly events: Readonly<Record<string, ExportedEvent>>;
}

interface ExportedEvent {
  readonly sequence: number;
  /** Fingerprint of the written event (time, length, texts, alarm). */
  readonly hash: string;
  /** The planned session's revision and day when exported ("plan changed since", CAL-04). */
  readonly revision: number;
  readonly localDate: string;
  readonly summary: string;
  readonly start: IcsStart;
  readonly cancelled?: true;
}

const DEFAULT_MINUTES = 60;
const STATUS_PLANNED = 'planned';

/** Builds the export without writing anything. */
export async function previewCalendarExport(
  deps: Deps,
  options: CalendarExportOptions,
): Promise<Result<CalendarPreview, CalendarExportError>> {
  const built = await build(deps, options);
  if (!built.ok) return built;
  const { fileName: _name, text: _text, record: _record, ...preview } = built.value;
  return ok(preview);
}

/** The `.ics` text and file name; call {@link recordCalendarExport} after delivering it. */
export async function exportCalendar(
  deps: Deps,
  options: CalendarExportOptions,
): Promise<Result<CalendarFile, CalendarExportError>> {
  return build(deps, options);
}

export async function recordCalendarExport(
  deps: Deps,
  record: CalendarExportRecord,
): Promise<void> {
  await deps.uow.write(['meta'], (repos) =>
    repos.meta.put({ key: CALENDAR_EXPORT_KEY, value: record as never }),
  );
}

/**
 * CAL-04 "re-export is offered when the plan changes": whether an exported, still upcoming
 * session moved, changed or went away since the last export. Null without an export.
 */
export async function calendarExportStatus(
  deps: Deps,
): Promise<{ readonly at: string; readonly changed: number } | null> {
  const from = today(deps);
  return deps.uow.read(['meta', 'plannedSessions'], async (repos) => {
    const record = await readRecord(repos);
    if (!record) return null;
    let changed = 0;
    for (const [id, event] of Object.entries(record.events)) {
      if (event.cancelled || event.localDate < from) continue;
      const session = await repos.plannedSessions.get(id as PlannedSessionId);
      if (
        !session ||
        session.status !== STATUS_PLANNED ||
        session.revision !== event.revision ||
        session.localDate !== event.localDate
      ) {
        changed++;
      }
    }
    return { at: record.at, changed };
  });
}

async function build(
  deps: Deps,
  options: CalendarExportOptions,
): Promise<Result<CalendarFile, CalendarExportError>> {
  const now = deps.clock.now();
  const from = today(deps);
  const loaded = await deps.uow.read(['plans', 'meets', 'meta'], async (repos) => {
    const plan = await repos.plans.getActive();
    if (!plan) return null;
    const meets = await repos.meets.list();
    const record = await readRecord(repos);
    return { plan, meets, record };
  });
  if (!loaded) return err({ kind: 'noPlan' });
  const { plan, meets, record } = loaded;

  const to = rangeEnd(plan, meets, from, options.range);
  if (to === null) return err({ kind: 'noMeet' });

  const [inRange, previous] = await deps.uow.read(['plannedSessions'], async (repos) => [
    await repos.plannedSessions.inRange(from, to),
    await Promise.all(
      Object.keys(record?.events ?? {}).map((id) =>
        repos.plannedSessions.get(id as PlannedSessionId),
      ),
    ),
  ]);
  const added = new Set<string>();
  const upcoming = (session: PlannedSession) =>
    session.status === STATUS_PLANNED && session.localDate >= from;

  const mesocycle = currentMesocycle(plan);
  const { rules } = await deps.rules.resolve(
    { style: plan.style, ...(mesocycle ? { level: mesocycle.level } : {}) },
    await userOverrides(deps),
  );
  const lookup = exerciseLookup(deps);
  const zone = now.zone;

  const events: IcsEvent[] = [];
  const nextRecord: Record<string, ExportedEvent> = { ...record?.events };
  let sessions = 0;
  let updates = 0;
  let cancelled = 0;
  let withoutTime = 0;
  const days: LocalDate[] = [];

  const addSession = (session: PlannedSession) => {
    const minutes = sessionMinutes(session, lookup, rules);
    const start = startOf(session, plan, options.time, zone, minutes);
    if (start.fallback) withoutTime++;
    const summary = options.texts.title({
      name: session.name.en,
      week: session.week,
      deload: session.kind === 'deload',
    });
    const description = options.texts.description({
      exercises: session.slots.map((slot) => ({
        name: lookup(slot.exerciseId)?.name.en ?? slot.exerciseId,
        sets: setsOf(slot.prescription),
      })),
      minutes,
    });
    const alarm =
      options.alarmMinutes > 0
        ? {
            minutesBefore: options.alarmMinutes,
            description: options.texts.alarm({ title: summary, minutes: options.alarmMinutes }),
          }
        : undefined;
    const hash = fingerprint([
      summary,
      description,
      JSON.stringify(start.ics),
      alarm?.minutesBefore ?? 0,
    ]);
    const prior = record?.events[session.id];
    const sequence =
      prior === undefined
        ? session.revision
        : prior.hash === hash && !prior.cancelled
          ? prior.sequence
          : Math.max(prior.sequence + 1, session.revision);
    events.push({
      uid: icsUid(session.id, options.host),
      sequence,
      status: 'CONFIRMED',
      start: start.ics,
      summary,
      description,
      ...(alarm ? { alarm } : {}),
    });
    nextRecord[session.id] = {
      sequence,
      hash,
      revision: session.revision,
      localDate: session.localDate,
      summary,
      start: start.ics,
    };
    days.push(session.localDate);
    added.add(session.id);
  };

  for (const session of inRange.toSorted(byDate)) {
    if (!upcoming(session)) continue;
    addSession(session);
    sessions++;
  }

  // CAL-04: earlier exported sessions outside this range that changed (moved, swapped) are
  // updated, and the ones that are gone (deleted, skipped, merged, during a break) cancelled.
  const exportedIds = Object.keys(record?.events ?? {});
  exportedIds.forEach((id, index) => {
    const prior = record!.events[id]!;
    if (added.has(id) || prior.cancelled) return;
    const session = previous[index];
    if (session && upcoming(session)) {
      if (session.revision === prior.revision && session.localDate === prior.localDate) return;
      addSession(session);
      updates++;
      return;
    }
    if (prior.localDate < from || (session && session.status === 'done')) return;
    const sequence = prior.sequence + 1;
    events.push({
      uid: icsUid(id, options.host),
      sequence,
      status: 'CANCELLED',
      start: prior.start,
      summary: prior.summary,
    });
    nextRecord[id] = { ...prior, sequence, cancelled: true };
    cancelled++;
  });

  if (events.length === 0) return err({ kind: 'nothingToExport' });

  const sortedDays = days.toSorted();
  const text = encodeIcs({
    prodId: `-//SZ WEB DEVELOPMENT//POWR ${deps.app.version}//EN`,
    dtStampEpochMs: now.epochMs,
    events,
  });
  return ok({
    from,
    to,
    sessions,
    updates,
    cancelled,
    withoutTime,
    first: sortedDays[0] ?? null,
    last: sortedDays.at(-1) ?? null,
    fileName: `powr-plan-${from}.ics`,
    text,
    record: { at: toIsoWithOffset(now), host: options.host, events: nextRecord },
  });
}

/** The last day of the range, or null for "until the meet" without an upcoming meet. */
function rangeEnd(
  plan: Plan,
  meets: readonly MeetInfo[],
  from: LocalDate,
  range: CalendarRange,
): LocalDate | null {
  if (range.kind === 'restOfWeek') return addDays(weekStartOf(from, plan.schedule.weekStartsOn), 6);
  if (range.kind === 'weeks') {
    return addDays(from, Math.max(1, Math.min(52, Math.round(range.weeks))) * 7 - 1);
  }
  if (range.kind === 'block') {
    const mesocycle = currentMesocycle(plan);
    if (!mesocycle) return addDays(from, 6);
    const weeks = mesocycle.accumulationWeeks + mesocycle.deloadWeeks;
    const end = addDays(mesocycle.startDate, weeks * 7 - 1);
    return end < from ? addDays(from, 6) : end;
  }
  // Until the meet: the next meet day from today on.
  const next = meets
    .map((meet) => meet.date)
    .filter((date) => date >= from)
    .toSorted()[0];
  return next ?? null;
}

function startOf(
  session: PlannedSession,
  plan: Plan,
  time: CalendarTime,
  zone: string,
  minutes: number,
): { readonly ics: IcsStart; readonly fallback: boolean } {
  const planned =
    time.kind === 'planned'
      ? plan.schedule.startTimes.find((entry) => entry.weekday === weekdayOf(session.localDate))
          ?.time
      : undefined;
  const clock =
    time.kind === 'fixed' ? time.time : time.kind === 'planned' ? (planned ?? time.fallback) : null;
  const fallback = time.kind === 'planned' && planned === undefined;
  if (clock === null) return { ics: { kind: 'date', date: session.localDate }, fallback };
  return {
    ics: {
      kind: 'dateTime',
      epochMs: instantAt(session.localDate, clock, zone).epochMs,
      durationMinutes: minutes,
    },
    fallback,
  };
}

/** PLN-14 estimate of the session, rounded up to 5 minutes. */
function sessionMinutes(
  session: PlannedSession,
  lookup: ReturnType<typeof exerciseLookup>,
  rules: Parameters<typeof dayMinutes>[2],
): number {
  const day = { key: session.dayKey, slots: session.slots } as PlanDay;
  const minutes = dayMinutes(day, lookup, rules).value;
  return minutes > 0 ? Math.max(15, Math.ceil(minutes / 5) * 5) : DEFAULT_MINUTES;
}

async function readRecord(repos: Repositories): Promise<CalendarExportRecord | null> {
  const value = (await repos.meta.get(CALENDAR_EXPORT_KEY))?.value as
    | CalendarExportRecord
    | null
    | undefined;
  return value && typeof value === 'object' && typeof value.events === 'object' ? value : null;
}

function byDate(a: PlannedSession, b: PlannedSession): number {
  return a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : a.id < b.id ? -1 : 1;
}

/** A small, stable string hash (FNV-1a) for change detection; not security relevant. */
function fingerprint(parts: readonly (string | number)[]): string {
  let hash = 0x811c9dc5;
  for (const char of parts.join('\u0000')) {
    hash ^= char.codePointAt(0)!;
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}
