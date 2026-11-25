import { addDays, toIsoWithOffset, toLocalDate, type LocalDate, type Session } from '@powr/domain';
import type { SettingsRecord } from '@powr/formats';

import type { Deps } from '../deps';
import type { Observable, Repositories } from '../ports';

/**
 * Backup reminders (DAT-08, TD-57). In-app only: scheduled notifications are not available to a
 * serverless PWA (PRD P-01). A reminder is due when the last backup is older than the cadence, or
 * when enough workouts were finished since it, or when there is training data and no backup.
 */
export const BACKUP_REMINDER = {
  /** The default cadence in days (DAT-08). */
  defaultDays: 14,
  /** The default while the browser has not protected the storage (DAT-03, §6.8). */
  unprotectedDays: 7,
  /** Finished workouts since the last backup that make it due regardless of age (DAT-08). */
  sessions: 8,
  /** "Remind me later" hides a due reminder for this many days. */
  snoozeDays: 3,
  /** The cadences offered in Data and backups. */
  choices: [7, 14, 30] as const,
} as const;

export type BackupReminderDays = (typeof BACKUP_REMINDER.choices)[number];

/** `meta` keys the reminder reads and writes. */
export const LAST_BACKUP_KEY = 'lastBackup';
export const BACKUP_REMINDER_KEY = 'backupReminder';

/** What the reminder is computed from: one read over `meta`, `settings` and `sessions`. */
export interface BackupReminderInputs {
  /** ISO 8601 with offset of the last successful export, null if there was none. */
  readonly lastBackupAt: string | null;
  /** The chosen cadence, null for off; undefined = the default. */
  readonly reminderDays: BackupReminderDays | null | undefined;
  /** ISO 8601 until which a due reminder stays hidden ("Remind me later"). */
  readonly snoozedUntil: string | null;
  /** Whether any workout was finished (or finished as partial) on this phone. */
  readonly hasTraining: boolean;
  /** Finished workouts since the last backup (counted only while it is under 30 days old). */
  readonly sessionsSinceBackup: number;
}

export type BackupReminderReason = 'never' | 'age' | 'sessions';

export interface BackupReminderState {
  /** The cadence in force, null when reminders are off. */
  readonly cadenceDays: number | null;
  /** Whether the cadence is the default (14, or 7 while storage is not protected). */
  readonly isDefault: boolean;
  readonly due: boolean;
  readonly reason: BackupReminderReason | null;
  /** Whole days since the last backup, null without one. */
  readonly daysSinceBackup: number | null;
  readonly sessionsSinceBackup: number;
  readonly snoozed: boolean;
  /** Due and not snoozed: Home and the workout summary show it. */
  readonly show: boolean;
  /** Storage is not protected: the reminder is shown more prominently (DAT-03). */
  readonly prominent: boolean;
}

const DAY_MS = 86_400_000;

/**
 * The reminder for the inputs, the storage protection (null while unknown) and the time now.
 * Pure: the screens call it with the live inputs and the storage status.
 */
export function backupReminderState(
  inputs: BackupReminderInputs,
  context: { readonly persisted: boolean | null; readonly nowEpochMs: number },
): BackupReminderState {
  const unprotected = context.persisted === false;
  const cadenceDays =
    inputs.reminderDays === undefined
      ? unprotected
        ? BACKUP_REMINDER.unprotectedDays
        : BACKUP_REMINDER.defaultDays
      : inputs.reminderDays;
  const lastEpoch = inputs.lastBackupAt === null ? null : Date.parse(inputs.lastBackupAt);
  const daysSinceBackup =
    lastEpoch === null || Number.isNaN(lastEpoch)
      ? null
      : Math.max(0, Math.floor((context.nowEpochMs - lastEpoch) / DAY_MS));
  const reason: BackupReminderReason | null =
    cadenceDays === null || !inputs.hasTraining
      ? null
      : daysSinceBackup === null
        ? 'never'
        : daysSinceBackup >= cadenceDays
          ? 'age'
          : inputs.sessionsSinceBackup >= BACKUP_REMINDER.sessions
            ? 'sessions'
            : null;
  const snoozeEpoch = inputs.snoozedUntil === null ? null : Date.parse(inputs.snoozedUntil);
  const snoozed =
    snoozeEpoch !== null && !Number.isNaN(snoozeEpoch) && snoozeEpoch > context.nowEpochMs;
  const due = reason !== null;
  return {
    cadenceDays,
    isDefault: inputs.reminderDays === undefined,
    due,
    reason,
    daysSinceBackup,
    sessionsSinceBackup: inputs.sessionsSinceBackup,
    snoozed,
    show: due && !snoozed,
    prominent: unprotected,
  };
}

/** The inputs as a live query: Home, the summary and Data re-render when any of them changes. */
export function observeBackupReminder(deps: Deps): Observable<BackupReminderInputs> {
  const today = toLocalDate(deps.clock.now());
  return deps.queries.observe(['meta', 'settings', 'sessions'], (repos) =>
    readBackupReminder(repos, today),
  );
}

/** Reads the inputs in one read transaction (also used by tests without live queries). */
export async function readBackupReminder(
  repos: Repositories,
  today: LocalDate,
): Promise<BackupReminderInputs> {
  const [backup, reminder, settings] = await Promise.all([
    repos.meta.get(LAST_BACKUP_KEY),
    repos.meta.get(BACKUP_REMINDER_KEY),
    repos.settings.get(),
  ]);
  const lastBackupAt = isoField(backup?.value, 'at');
  const snoozedUntil = isoField(reminder?.value, 'snoozedUntil');
  const reminderDays = reminderDaysOf(settings);

  let hasTraining = false;
  let sessionsSinceBackup = 0;
  const lastEpoch = lastBackupAt === null ? null : Date.parse(lastBackupAt);
  if (lastEpoch !== null && !Number.isNaN(lastEpoch)) {
    const from = lastBackupAt!.slice(0, 10) as LocalDate;
    // At 30 days or more the age alone makes it due for every cadence: no need to count.
    if (from >= addDays(today, -BACKUP_REMINDER.choices.at(-1)!)) {
      const since = (await repos.sessions.inRange(from, today)).filter(
        (session) => isCompleted(session) && (session.endedAt?.epochMs ?? 0) > lastEpoch,
      );
      sessionsSinceBackup = since.length;
    }
    hasTraining = true;
  } else {
    const latest = await repos.sessions.latestBefore(addDays(today, 2));
    hasTraining =
      latest !== undefined &&
      (isCompleted(latest) ||
        (await repos.sessions.inRange(addDays(latest.localDate, -60), latest.localDate)).some(
          isCompleted,
        ));
  }
  return { lastBackupAt, reminderDays, snoozedUntil, hasTraining, sessionsSinceBackup };
}

/** "Remind me later": hides a due reminder for {@link BACKUP_REMINDER.snoozeDays} days. */
export async function snoozeBackupReminder(deps: Deps): Promise<void> {
  const now = deps.clock.now();
  const until = { ...now, epochMs: now.epochMs + BACKUP_REMINDER.snoozeDays * DAY_MS };
  await deps.uow.write(['meta'], (repos) =>
    repos.meta.put({ key: BACKUP_REMINDER_KEY, value: { snoozedUntil: toIsoWithOffset(until) } }),
  );
}

/** Sets the cadence (7, 14 or 30 days), null for off, or undefined to go back to the default. */
export async function setBackupReminderDays(
  deps: Deps,
  days: BackupReminderDays | null | undefined,
): Promise<void> {
  await deps.uow.write(['settings'], async (repos) => {
    const current = (await repos.settings.get()) ?? { id: 'me' as const, theme: 'system' as const };
    const { backup: _previous, ...rest } = current;
    await repos.settings.put(
      days === undefined ? rest : { ...rest, backup: { reminderDays: days } },
    );
  });
}

function reminderDaysOf(
  settings: SettingsRecord | undefined,
): BackupReminderDays | null | undefined {
  return settings?.backup === undefined ? undefined : settings.backup.reminderDays;
}

function isCompleted(session: Session): boolean {
  return session.status === 'finished' || session.status === 'partial';
}

function isoField(value: unknown, key: string): string | null {
  if (value === null || typeof value !== 'object') return null;
  const field = (value as Record<string, unknown>)[key];
  return typeof field === 'string' && !Number.isNaN(Date.parse(field)) ? field : null;
}
