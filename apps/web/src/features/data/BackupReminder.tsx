import { Plural, Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { HardDriveDownload, ShieldAlert } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { BACKUP_REMINDER } from '@powr/application/data';

import { Button, buttonClass } from '#ui/button';
import { cn } from '#ui/cn';
import { Card } from '#ui/screen';

import { useBackupReminder } from '../../hooks/use-backup-reminder';

/**
 * The backup reminder (DAT-08, TD-57) on Home and after a finished workout: shown when the last
 * backup is older than the cadence, after 8 workouts without one, or when there is training data
 * and no backup at all; more prominent while the browser has not protected the storage (DAT-03).
 * "Remind me later" hides it for 3 days and keeps the keyboard focus on a confirmation.
 */
export function BackupReminder({ className }: { className?: string }) {
  const { state, snooze } = useBackupReminder();
  const [snoozed, setSnoozed] = useState(false);
  const confirmation = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (snoozed) confirmation.current?.focus();
  }, [snoozed]);

  if (snoozed) {
    return (
      <p
        ref={confirmation}
        tabIndex={-1}
        data-testid="backup-reminder-snoozed"
        className="text-sm text-fg-muted outline-none"
      >
        <Plural
          value={BACKUP_REMINDER.snoozeDays}
          one="Okay. POWR reminds you again in # day."
          other="Okay. POWR reminds you again in # days."
        />
      </p>
    );
  }
  if (!state?.show) return null;

  const later = async () => {
    await snooze();
    setSnoozed(true);
  };

  return (
    <Card className={cn(state.prominent && 'border-2 border-warning', className)}>
      <h2 data-testid="backup-reminder" className="flex items-center gap-2 text-lg font-bold">
        <HardDriveDownload aria-hidden="true" />
        <Trans>Back up your training</Trans>
      </h2>
      <p>
        {state.reason === 'never' ? (
          <Trans>Your training lives only on this phone. A backup file keeps it safe.</Trans>
        ) : state.reason === 'sessions' ? (
          <Plural
            value={state.sessionsSinceBackup}
            one="You finished # workout since your last backup."
            other="You finished # workouts since your last backup."
          />
        ) : (
          <Plural
            value={state.daysSinceBackup ?? 0}
            one="Your last backup is # day old."
            other="Your last backup is # days old."
          />
        )}
      </p>
      {state.prominent ? (
        <p className="flex items-start gap-2">
          <ShieldAlert aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-warning" />
          <span>
            <Trans>
              Storage is not protected: the browser may delete POWR data when the phone runs low on
              space.
            </Trans>
          </span>
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <Link to="/data" className={buttonClass({ variant: 'primary', size: 'lg' })}>
          <Trans>Back up now</Trans>
        </Link>
        <Button size="lg" onClick={() => void later()}>
          <Trans>Remind me later</Trans>
        </Button>
      </div>
    </Card>
  );
}
