/**
 * `@powr/application/data` (M5d): backup reminders (DAT-08, TD-57) and the safety copies
 * (§8.2.1, TD-14). Small and free of Zod and fflate; only screens that are lazy route chunks
 * import it, so it stays off the startup path (§8.19). The backup codec itself stays in
 * `@powr/application/backup`.
 */
export {
  BACKUP_REMINDER,
  BACKUP_REMINDER_KEY,
  LAST_BACKUP_KEY,
  backupReminderState,
  observeBackupReminder,
  readBackupReminder,
  setBackupReminderDays,
  snoozeBackupReminder,
  type BackupReminderDays,
  type BackupReminderInputs,
  type BackupReminderReason,
  type BackupReminderState,
} from './reminder';
export {
  SAFETY_COPIES,
  deleteSafetyCopy,
  listSafetyCopies,
  pruneSafetyCopies,
  safetyCopiesToPrune,
  saveSafetyCopy,
} from './safety';
