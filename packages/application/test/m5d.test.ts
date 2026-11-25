import { describe, expect, it } from 'vitest';

import {
  SESSION_DEFAULTS,
  makeInstantTz,
  type IsoWeekday,
  type LocalDate,
  type PlannedSession,
  type PresetId,
  type Session,
  type SessionId,
} from '@powr/domain';
import { emptyRawTables, type RawTables } from '@powr/formats';
import { decodeBackup, validateRawTables } from '@powr/formats/backup';

import {
  BACKUP_REMINDER,
  backupReminderState,
  deleteSafetyCopy,
  listSafetyCopies,
  readBackupReminder,
  saveSafetyCopy,
  setBackupReminderDays,
  snoozeBackupReminder,
  type BackupReminderInputs,
} from '../src/data';
import {
  calendarExportStatus,
  completeOnboarding,
  equipmentProfileFromPreset,
  exportCalendar,
  generatePlanPreview,
  moveSession,
  recordCalendarExport,
  type CalendarExportOptions,
  type CalendarTexts,
  type OnboardingAnswers,
} from '../src/planning';
import { exportBackup, saveRescueCopy, snapshotBeforeUpgrade } from '../src/usecases/backup';
import { createTestDeps } from './fakes';

const DAY = 86_400_000;
const NOW = Date.parse('2026-11-24T17:00:00Z');

function inputs(overrides: Partial<BackupReminderInputs> = {}): BackupReminderInputs {
  return {
    lastBackupAt: null,
    reminderDays: undefined,
    snoozedUntil: null,
    hasTraining: true,
    sessionsSinceBackup: 0,
    ...overrides,
  };
}

const iso = (epochMs: number) => new Date(epochMs).toISOString();

describe('backup reminder rules (DAT-08, TD-57)', () => {
  const at = { persisted: true, nowEpochMs: NOW };

  it('is due with training data and no backup, and never without training data', () => {
    expect(backupReminderState(inputs(), at)).toMatchObject({
      due: true,
      show: true,
      reason: 'never',
      cadenceDays: 14,
      isDefault: true,
    });
    expect(backupReminderState(inputs({ hasTraining: false }), at)).toMatchObject({
      due: false,
      show: false,
      reason: null,
    });
  });

  it('defaults to 14 days, or 7 while the storage is not protected (and then shows prominently)', () => {
    const tenDaysOld = inputs({ lastBackupAt: iso(NOW - 10 * DAY) });
    expect(backupReminderState(tenDaysOld, at)).toMatchObject({ due: false, cadenceDays: 14 });
    expect(backupReminderState(tenDaysOld, { ...at, persisted: false })).toMatchObject({
      due: true,
      reason: 'age',
      cadenceDays: 7,
      daysSinceBackup: 10,
      prominent: true,
    });
    // Unknown protection: the normal default, not prominent.
    expect(backupReminderState(tenDaysOld, { ...at, persisted: null })).toMatchObject({
      cadenceDays: 14,
      prominent: false,
    });
  });

  it('honours a chosen cadence over the default, and off turns every reminder off', () => {
    const twentyDaysOld = inputs({ lastBackupAt: iso(NOW - 20 * DAY) });
    expect(backupReminderState({ ...twentyDaysOld, reminderDays: 30 }, at).due).toBe(false);
    expect(backupReminderState({ ...twentyDaysOld, reminderDays: 7 }, at)).toMatchObject({
      due: true,
      isDefault: false,
    });
    expect(
      backupReminderState({ ...twentyDaysOld, reminderDays: 30 }, { ...at, persisted: false })
        .cadenceDays,
    ).toBe(30);
    for (const off of [
      inputs({ reminderDays: null }),
      inputs({ reminderDays: null, lastBackupAt: iso(NOW - 90 * DAY), sessionsSinceBackup: 40 }),
    ]) {
      expect(backupReminderState(off, at)).toMatchObject({ due: false, cadenceDays: null });
    }
  });

  it('is due after 8 workouts since the last backup, whatever its age', () => {
    const recent = inputs({ lastBackupAt: iso(NOW - 2 * DAY) });
    expect(backupReminderState({ ...recent, sessionsSinceBackup: 7 }, at).due).toBe(false);
    expect(
      backupReminderState({ ...recent, sessionsSinceBackup: BACKUP_REMINDER.sessions }, at),
    ).toMatchObject({ due: true, reason: 'sessions', sessionsSinceBackup: 8 });
  });

  it('"Remind me later" hides a due reminder until the snooze ends', () => {
    const snoozed = inputs({ snoozedUntil: iso(NOW + DAY) });
    expect(backupReminderState(snoozed, at)).toMatchObject({
      due: true,
      snoozed: true,
      show: false,
    });
    expect(backupReminderState(snoozed, { ...at, nowEpochMs: NOW + 2 * DAY })).toMatchObject({
      snoozed: false,
      show: true,
    });
  });
});

function finishedSession(id: string, localDate: string, endedAtMs: number): Session {
  return {
    id: id as SessionId,
    localDate: localDate as LocalDate,
    startedAt: makeInstantTz(endedAtMs - 3_600_000, 'Europe/Zurich'),
    endedAt: makeInstantTz(endedAtMs, 'Europe/Zurich'),
    status: 'finished',
    versions: { engine: '0.0.0', rules: '0.0.0+m0', content: '0.0.0+m0' },
    ...SESSION_DEFAULTS,
  };
}

function tablesWith(sessions: Session[]): RawTables {
  return { ...emptyRawTables(), settings: [{ id: 'me', theme: 'dark' }], sessions };
}

const readInputs = (test: ReturnType<typeof createTestDeps>, today: string) =>
  test.deps.uow.read(['meta', 'settings', 'sessions'], (repos) =>
    readBackupReminder(repos, today as LocalDate),
  );

describe('backup reminder inputs and settings (DAT-08)', () => {
  it('reads training, the last backup, workouts since it, the snooze and the cadence', async () => {
    const empty = createTestDeps(tablesWith([]));
    expect(await readInputs(empty, '2026-11-24')).toMatchObject({
      hasTraining: false,
      lastBackupAt: null,
    });

    const test = createTestDeps(
      tablesWith([finishedSession('s1', '2026-11-20', Date.parse('2026-11-20T18:00:00Z'))]),
    );
    expect(await readInputs(test, '2026-11-24')).toMatchObject({
      hasTraining: true,
      lastBackupAt: null,
      sessionsSinceBackup: 0,
      reminderDays: undefined,
    });

    // A backup resets the count; workouts finished after it count again.
    const exported = await exportBackup(test.deps);
    expect(exported.ok).toBe(true);
    const after = Date.parse('2026-11-24T19:00:00Z');
    await test.deps.uow.write(['sessions'], async (repos) => {
      await repos.sessions.put(finishedSession('s2', '2026-11-24', after));
      await repos.sessions.put(finishedSession('s3', '2026-11-24', after + 1000));
    });
    const read = await readInputs(test, '2026-11-24');
    expect(read.lastBackupAt).toMatch(/^2026-11-24T/);
    expect(read.sessionsSinceBackup).toBe(2);

    await snoozeBackupReminder(test.deps);
    expect((await readInputs(test, '2026-11-24')).snoozedUntil).toMatch(/^2026-11-2[78]T/);

    await setBackupReminderDays(test.deps, 30);
    expect((await readInputs(test, '2026-11-24')).reminderDays).toBe(30);
    await setBackupReminderDays(test.deps, null);
    expect((await readInputs(test, '2026-11-24')).reminderDays).toBeNull();
    await setBackupReminderDays(test.deps, undefined);
    expect((await readInputs(test, '2026-11-24')).reminderDays).toBeUndefined();
  });

  it('writes a settings record the strict v2 schema accepts', async () => {
    const test = createTestDeps(tablesWith([]));
    await setBackupReminderDays(test.deps, 7);
    const settings = test.data().settings;
    expect(settings).toEqual([{ id: 'me', theme: 'dark', backup: { reminderDays: 7 } }]);
    expect(validateRawTables({ ...emptyRawTables(), settings }).ok).toBe(true);
  });
});

describe('safety copies (§8.2.1, TD-14)', () => {
  it('lists, saves and deletes the copies taken before a data update', async () => {
    const test = createTestDeps(tablesWith([]));
    const raw = {
      dataVersion: 1,
      tables: { settings: [{ id: 'me', theme: 'dark' }], meta: [], sessions: [], sets: [] },
    };
    const env = {
      app: test.deps.app,
      clock: test.deps.clock,
      ids: test.deps.ids,
      safety: test.deps.safety,
      files: test.deps.files,
      rulesVersion: 'r',
      contentVersion: 'c',
    };
    const snapshot = await snapshotBeforeUpgrade(env, raw);
    const copies = await listSafetyCopies(test.deps);
    expect(copies).toEqual([
      expect.objectContaining({ fileName: snapshot.fileName, reason: 'migration' }),
    ]);
    // The copy is a v1 backup the current import migrates.
    const stored = test.safetySnapshots[0]!.bytes;
    const decoded = await decodeBackup(stored);
    expect(decoded.ok && decoded.backup.preview.dataVersion).toBe(1);

    const saved = await saveSafetyCopy(test.deps, copies[0]!.id);
    expect(saved).toEqual({ ok: true, value: 'downloaded' });
    expect(test.savedFiles.at(-1)?.name).toBe(snapshot.fileName);
    expect(await saveSafetyCopy(test.deps, 999)).toEqual({ ok: false, error: { kind: 'missing' } });

    await deleteSafetyCopy(test.deps, copies[0]!.id);
    expect(await listSafetyCopies(test.deps)).toEqual([]);

    // The recovery screen's rescue copy goes straight to the file gateway.
    const rescue = await saveRescueCopy(env, raw);
    expect(rescue.delivery).toBe('downloaded');
    expect(test.savedFiles.at(-1)?.name).toBe(rescue.fileName);
  });
});

// --- Calendar export (CAL-01…05) ----------------------------------------------------------------

const TEXTS: CalendarTexts = {
  title: ({ name, week, deload }) => `POWR · ${name} (Week ${week}${deload ? ', deload' : ''})`,
  description: ({ exercises, minutes }) =>
    [...exercises.map(({ name, sets }) => `${name}: ${sets} sets`), `About ${minutes} min`].join(
      '\n',
    ),
  alarm: ({ title }) => `Soon: ${title}`,
};

function options(overrides: Partial<CalendarExportOptions> = {}): CalendarExportOptions {
  return {
    range: { kind: 'weeks', weeks: 2 },
    time: { kind: 'planned', fallback: '07:30' },
    alarmMinutes: 30,
    host: 'powr.invalid',
    texts: TEXTS,
    ...overrides,
  };
}

async function withPlan(
  start: string,
  startTimes: { weekday: IsoWeekday; time: string }[] = [{ weekday: 1, time: '18:00' }],
) {
  const test = createTestDeps(undefined, { start });
  const equipment = equipmentProfileFromPreset(test.deps, {
    presetId: 'preset.commercial-gym' as PresetId,
    unit: 'kg',
    name: 'Gym',
  });
  if (!equipment.ok) throw new Error('preset missing');
  const answers: OnboardingAnswers = {
    units: { load: 'kg', bodyweight: 'kg', length: 'cm' },
    sex: 'preferNotToSay',
    referenceSet: null,
    birthYear: null,
    height: null,
    bodyweight: null,
    style: 'bodybuilding',
    phase: 'notTracking',
    experience: {
      trainingAge: 'years2To5',
      timeOff: 'upTo1Week',
      rpeFamiliarity: 'some',
      recentVolume: [],
    },
    levelOverride: null,
    schedule: { weekdays: [1, 3, 5], sessionMinutes: 60 },
    startTimes,
    equipment: equipment.value,
    priorities: [],
    avoid: { exercises: [], patterns: [] },
    preferredExercises: [],
    baselines: [],
    meet: null,
  };
  const preview = await generatePlanPreview(test.deps, {
    answers,
    options: { weekStartsOn: 1 },
    startTimes,
  });
  if (!preview.ok) throw new Error(`no plan: ${preview.error.kind}`);
  const done = await completeOnboarding(test.deps, { answers, preview: preview.value });
  if (!done.ok) throw new Error('onboarding failed');
  return test;
}

/** RFC 5545 content lines (unfolded) of a calendar text. */
function lines(text: string): string[] {
  return text.replaceAll('\r\n ', '').split('\r\n').filter(Boolean);
}

function events(text: string): Record<string, string>[] {
  const result: Record<string, string>[] = [];
  let current: Record<string, string> | null = null;
  let depth = 0;
  for (const line of lines(text)) {
    if (line === 'BEGIN:VEVENT') current = {};
    else if (line === 'END:VEVENT') {
      result.push(current!);
      current = null;
    } else if (line === 'BEGIN:VALARM') depth++;
    else if (line === 'END:VALARM') depth--;
    else if (current) {
      const name = line.slice(0, line.indexOf(':'));
      current[depth > 0 ? `VALARM.${name}` : name] = line.slice(line.indexOf(':') + 1);
    }
  }
  return result;
}

/** The events without DTSTAMP (the export time, which differs between two exports). */
function content(text: string): Record<string, string>[] {
  return events(text).map(({ DTSTAMP: _stamp, ...rest }) => rest);
}

const planned = (test: ReturnType<typeof createTestDeps>): readonly PlannedSession[] =>
  test.data().plannedSessions;

describe('calendar export (CAL-01…05)', () => {
  it('writes the planned sessions of the range with stable UIDs, times, durations and alarms', async () => {
    const test = await withPlan('2026-11-24T09:00:00Z');
    const result = await exportCalendar(test.deps, options());
    if (!result.ok) throw new Error(result.error.kind);
    const file = result.value;
    expect(file.fileName).toBe('powr-plan-2026-11-24.ics');
    expect(file.text.startsWith('BEGIN:VCALENDAR\r\nVERSION:2.0\r\n')).toBe(true);
    expect(file.text.endsWith('END:VCALENDAR\r\n')).toBe(true);

    const upcoming = planned(test)
      .filter((session) => session.localDate >= '2026-11-24' && session.localDate <= '2026-12-07')
      .toSorted((a, b) => (a.localDate < b.localDate ? -1 : 1));
    const written = events(file.text);
    expect(file.sessions).toBe(upcoming.length);
    expect(written.map((event) => event['UID'])).toEqual(
      upcoming.map((session) => `${session.id}@powr.invalid`),
    );
    for (const [index, event] of written.entries()) {
      const session = upcoming[index]!;
      // Mondays have a planned 18:00 (17:00Z in winter); the other days use the fallback 07:30.
      const monday = new Date(`${session.localDate}T12:00:00Z`).getUTCDay() === 1;
      const day = session.localDate.replaceAll('-', '');
      expect(event['DTSTART']).toBe(monday ? `${day}T170000Z` : `${day}T063000Z`);
      expect(event['DURATION']).toMatch(/^PT(\d+H)?(\d+M)?$/);
      expect(event['STATUS']).toBe('CONFIRMED');
      expect(event['SEQUENCE']).toBe(String(session.revision));
      expect(event['SUMMARY']).toBe(`POWR · ${session.name.en} (Week ${session.week})`);
      expect(event['DESCRIPTION']).toContain('sets');
      expect(event['VALARM.TRIGGER']).toBe('-PT30M');
      expect(event['VALARM.ACTION']).toBe('DISPLAY');
    }
    expect(file.withoutTime).toBe(
      written.filter((event) => !event['DTSTART']!.endsWith('T170000Z')).length,
    );
  });

  it('updates a moved session with a higher SEQUENCE, keeps the others, and says the plan changed', async () => {
    const test = await withPlan('2026-11-24T09:00:00Z');
    const first = await exportCalendar(test.deps, options());
    if (!first.ok) throw new Error(first.error.kind);
    await recordCalendarExport(test.deps, first.value.record);
    expect(await calendarExportStatus(test.deps)).toMatchObject({ changed: 0 });

    // The same export again: identical events, identical sequences (no duplicates, no churn).
    const again = await exportCalendar(test.deps, options());
    if (!again.ok) throw new Error(again.error.kind);
    expect(content(again.value.text)).toEqual(content(first.value.text));

    const target = events(first.value.text)[1]!;
    const id = target['UID']!.split('@')[0]!;
    const session = planned(test).find((entry) => entry.id === id)!;
    const moved = await moveSession(test.deps, {
      sessionId: session.id,
      date: '2026-12-06' as LocalDate,
    });
    expect(moved.ok).toBe(true);
    expect(await calendarExportStatus(test.deps)).toMatchObject({ changed: 1 });

    const second = await exportCalendar(test.deps, options());
    if (!second.ok) throw new Error(second.error.kind);
    const updated = events(second.value.text).find((event) => event['UID'] === target['UID'])!;
    expect(Number(updated['SEQUENCE'])).toBeGreaterThan(Number(target['SEQUENCE']));
    expect(updated['DTSTART']).toMatch(/^20261206T/);
    const untouched = content(first.value.text).filter((event) => event['UID'] !== target['UID']);
    for (const event of untouched) {
      expect(content(second.value.text)).toContainEqual(event);
    }
    await recordCalendarExport(test.deps, second.value.record);
    expect(await calendarExportStatus(test.deps)).toMatchObject({ changed: 0 });
  });

  it('cancels an exported session that is no longer planned (STATUS:CANCELLED, same UID)', async () => {
    const test = await withPlan('2026-11-24T09:00:00Z');
    const first = await exportCalendar(test.deps, options());
    if (!first.ok) throw new Error(first.error.kind);
    await recordCalendarExport(test.deps, first.value.record);

    const target = events(first.value.text)[0]!;
    const id = target['UID']!.split('@')[0]!;
    await test.deps.uow.write(['plannedSessions'], async (repos) => {
      const session = await repos.plannedSessions.get(id as never);
      await repos.plannedSessions.putMany([
        { ...session!, status: 'skipped', revision: session!.revision + 1 },
      ]);
    });

    const second = await exportCalendar(test.deps, options());
    if (!second.ok) throw new Error(second.error.kind);
    expect(second.value.cancelled).toBe(1);
    const cancelled = events(second.value.text).find((event) => event['UID'] === target['UID'])!;
    expect(cancelled).toMatchObject({
      STATUS: 'CANCELLED',
      SEQUENCE: String(Number(target['SEQUENCE']) + 1),
      DTSTART: target['DTSTART'],
      SUMMARY: target['SUMMARY'],
    });
    expect(cancelled['VALARM.TRIGGER']).toBeUndefined();

    // Once cancelled in the calendar, it is not cancelled again.
    await recordCalendarExport(test.deps, second.value.record);
    const third = await exportCalendar(test.deps, options());
    expect(third.ok && third.value.cancelled).toBe(0);
  });

  it('keeps the local wall-clock time across a DST change (CAL-03)', async () => {
    // Europe/Zurich switches to summer time on Sunday 28 March 2027.
    const test = await withPlan('2027-03-22T08:00:00Z', [
      { weekday: 1, time: '18:00' },
      { weekday: 3, time: '18:00' },
      { weekday: 5, time: '18:00' },
    ]);
    const result = await exportCalendar(test.deps, options({ range: { kind: 'weeks', weeks: 2 } }));
    if (!result.ok) throw new Error(result.error.kind);
    const starts = events(result.value.text).map((event) => event['DTSTART']!);
    const before = starts.filter((start) => start < '20270328');
    const after = starts.filter((start) => start > '20270328');
    expect(before.length).toBeGreaterThan(0);
    expect(after.length).toBeGreaterThan(0);
    for (const start of before) expect(start.endsWith('T170000Z')).toBe(true);
    for (const start of after) expect(start.endsWith('T160000Z')).toBe(true);
  });

  it('writes all-day events, events without an alarm, and refuses impossible ranges', async () => {
    const test = await withPlan('2026-11-24T09:00:00Z');
    const allDay = await exportCalendar(
      test.deps,
      options({ time: { kind: 'allDay' }, alarmMinutes: 0 }),
    );
    if (!allDay.ok) throw new Error(allDay.error.kind);
    const written = events(allDay.value.text);
    expect(written.length).toBeGreaterThan(0);
    for (const event of written) {
      expect(Object.keys(event)).toContain('DTSTART;VALUE=DATE');
      expect(Object.keys(event)).toContain('DTEND;VALUE=DATE');
      expect(event['VALARM.TRIGGER']).toBeUndefined();
    }
    expect(await exportCalendar(test.deps, options({ range: { kind: 'untilMeet' } }))).toEqual({
      ok: false,
      error: { kind: 'noMeet' },
    });

    const noPlan = createTestDeps();
    expect(await exportCalendar(noPlan.deps, options())).toEqual({
      ok: false,
      error: { kind: 'noPlan' },
    });
  });
});
