import { useMemo } from 'react';

import {
  backupReminderState,
  observeBackupReminder,
  setBackupReminderDays,
  snoozeBackupReminder,
  type BackupReminderDays,
  type BackupReminderState,
} from '@powr/application/data';

import { useContainer } from '../app/container-context';
import { useStorageStatus } from './use-data';
import { useObservable } from './use-observable';

/**
 * The backup reminder (DAT-08, TD-57) for Home, the workout summary and Data and backups: the
 * live inputs (last backup, cadence, snooze, workouts since) with the storage protection. Only
 * lazy screens import it, so `@powr/application/data` stays off the startup path.
 */
export function useBackupReminder(): {
  readonly state: BackupReminderState | null;
  readonly snooze: () => Promise<void>;
  readonly setDays: (days: BackupReminderDays | null | undefined) => Promise<void>;
} {
  const { deps } = useContainer();
  const observable = useMemo(() => observeBackupReminder(deps), [deps]);
  const inputs = useObservable(observable);
  const { status } = useStorageStatus();
  const state = useMemo(
    () =>
      inputs.loaded
        ? backupReminderState(inputs.value, {
            persisted: status?.persisted ?? null,
            nowEpochMs: deps.clock.now().epochMs,
          })
        : null,
    [inputs, status, deps],
  );
  return {
    state,
    snooze: () => snoozeBackupReminder(deps),
    setDays: (days) => setBackupReminderDays(deps, days),
  };
}
