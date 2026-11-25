import { plural } from '@lingui/core/macro';
import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { ChevronRight, ShieldAlert, ShieldCheck, Trash2 } from 'lucide-react';
import { useId, useRef, useState } from 'react';

import type { SafetySnapshotInfo } from '@powr/application';
import type { BackupError, DecodedBackup } from '@powr/application/backup';
import type { BackupReminderDays } from '@powr/application/data';
import type { InsightsReport } from '@powr/application/insights';

import { Button } from '#ui/button';
import { ChoiceCards } from '#ui/choice';
import { Input } from '#ui/input';
import { Card, Screen } from '#ui/screen';
import { Sheet } from '#ui/sheet';

import { useBackupReminder } from '../../hooks/use-backup-reminder';
import {
  useDeleteAllData,
  useExportBackup,
  useImportBackup,
  useMeta,
  useSafetyCopies,
  useStorageStatus,
} from '../../hooks/use-data';
import { useInsights } from '../../hooks/use-insights';
import { useActiveSession } from '../../hooks/use-session';
import { formatBytes, formatDateTime } from '../../i18n/format';

/**
 * Data and backups (DAT-01…08, DAT-13, M5d): storage protection and use, the backup with its
 * reminder cadence, restore, the safety copies, "Verify data" and "Delete all data".
 */
export function DataScreen() {
  const { t } = useLingui();
  return (
    <Screen title={t`Data and backups`}>
      <StorageCard />
      <BackupCard />
      <RestoreCard />
      <SafetyCopiesCard />
      <VerifyCard />
      <Link
        to="/settings/device-support"
        className="flex min-h-target items-center justify-between gap-2 rounded-2xl bg-surface p-4 font-semibold"
      >
        <Trans>What works on this phone</Trans>
        <ChevronRight aria-hidden="true" className="size-5 shrink-0" />
      </Link>
      <DeleteAllCard />
    </Screen>
  );
}

/**
 * DAT-03/04: "Storage protected: Yes/No" with the risk in one sentence and an explained,
 * tap-initiated request; the browser's estimate of use and quota ("unknown" where not reported).
 */
function StorageCard() {
  const { status, requestPersistence } = useStorageStatus();
  const [asked, setAsked] = useState<'granted' | 'refused' | null>(null);
  if (!status) return null;
  const ask = async () => setAsked((await requestPersistence()) ? 'granted' : 'refused');
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Storage</Trans>
      </h2>
      <p data-testid="storage-protected" className="flex items-center gap-2 font-semibold">
        {status.persisted ? (
          <>
            <ShieldCheck aria-hidden="true" className="size-5 shrink-0 text-success" />
            <Trans>Storage protected: Yes</Trans>
          </>
        ) : (
          <>
            <ShieldAlert aria-hidden="true" className="size-5 shrink-0 text-warning" />
            <Trans>Storage protected: No</Trans>
          </>
        )}
      </p>
      {status.persisted ? (
        <p className="text-sm text-fg-muted">
          <Trans>
            The browser keeps POWR data even when space runs low. Clearing site data or uninstalling
            still deletes everything, so keep backups.
          </Trans>
        </p>
      ) : (
        <>
          <p className="text-sm text-fg-muted">
            <Trans>
              Without protection the browser may delete POWR data when the phone runs low on space.
              Back up regularly either way: clearing site data or uninstalling deletes everything.
            </Trans>
          </p>
          <p className="text-sm text-fg-muted">
            <Trans>
              The browser decides by itself whether to protect it. Installing POWR on the home
              screen or allowing notifications makes a yes more likely.
            </Trans>
          </p>
          <Button onClick={() => void ask()}>
            <Trans>Protect my data</Trans>
          </Button>
        </>
      )}
      <output data-testid="storage-request" className="block text-sm empty:hidden">
        {asked === 'granted' ? <Trans>Done: the browser now protects POWR data.</Trans> : null}
        {asked === 'refused' ? (
          <Trans>
            The browser said no for now. POWR asks again after you install it or allow
            notifications. Until then, reminders to back up come every 7 days.
          </Trans>
        ) : null}
      </output>
      <p data-testid="storage-usage" className="text-sm">
        {status.estimate ? (
          <Trans>
            Using {formatBytes(status.estimate.usage)} of the {formatBytes(status.estimate.quota)}{' '}
            this browser allows.
          </Trans>
        ) : (
          <Trans>Storage use: Not reported by this browser.</Trans>
        )}
      </p>
    </Card>
  );
}

type ExportState =
  | { readonly kind: 'idle' }
  | { readonly kind: 'busy' }
  | { readonly kind: 'done'; readonly fileName: string }
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'failed' };

/** One tap exports; the state says where the file went or why it did not (DAT-05, NFR-REL-04). */
function useExport() {
  const exportBackup = useExportBackup();
  const [state, setState] = useState<ExportState>({ kind: 'idle' });
  const run = async () => {
    setState({ kind: 'busy' });
    try {
      const result = await exportBackup();
      setState(
        result.ok ? { kind: 'done', fileName: result.value.fileName } : { kind: 'cancelled' },
      );
    } catch {
      setState({ kind: 'failed' });
    }
  };
  return { state, run };
}

function ExportStatus({ state, testId }: { state: ExportState; testId: string }) {
  return (
    <output data-testid={testId} className="block text-sm empty:hidden">
      {state.kind === 'busy' ? <Trans>Creating the backup…</Trans> : null}
      {state.kind === 'done' ? (
        <Trans>
          Saved to Downloads as {state.fileName}. Copy it off the phone, for example to cloud
          storage.
        </Trans>
      ) : null}
      {state.kind === 'cancelled' ? <Trans>Not saved.</Trans> : null}
      {state.kind === 'failed' ? (
        <Trans>
          The backup could not be created. Nothing was changed. If the phone is low on space, free
          some and try again.
        </Trans>
      ) : null}
    </output>
  );
}

/** DAT-05 export and DAT-08 reminder cadence. */
function BackupCard() {
  const { t } = useLingui();
  const lastBackup = useMeta('lastBackup');
  const { state: exportState, run } = useExport();
  const reminder = useBackupReminder();

  const last = lastBackup.loaded
    ? (lastBackup.value?.value as { at?: string } | undefined)?.at
    : undefined;
  const lastText = last ? formatDateTime(Date.parse(last)) : null;
  const unprotected = reminder.state?.prominent ?? false;
  const choice = reminder.state
    ? reminder.state.isDefault
      ? 'auto'
      : reminder.state.cadenceDays === null
        ? 'off'
        : String(reminder.state.cadenceDays)
    : null;
  const autoDays = unprotected ? 7 : 14;

  const choose = (value: string) =>
    void reminder.setDays(
      value === 'auto' ? undefined : value === 'off' ? null : (Number(value) as BackupReminderDays),
    );

  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Backup</Trans>
      </h2>
      <p data-testid="last-backup" className="text-sm text-fg-muted">
        {lastText ? <Trans>Last backup: {lastText}</Trans> : <Trans>No backup yet.</Trans>}
      </p>
      <p className="text-sm text-fg-muted">
        <Trans>
          A backup is one file with all your data. Keep it somewhere other than this phone.
        </Trans>
      </p>
      <Button
        variant="primary"
        size="lg"
        disabled={exportState.kind === 'busy'}
        onClick={() => void run()}
      >
        <Trans>Export backup</Trans>
      </Button>
      <ExportStatus state={exportState} testId="export-status" />

      {choice === null ? null : (
        <ChoiceCards
          className="mt-2"
          legend={t`Backup reminders`}
          hint={
            <Trans>
              Reminders show on Home and after a workout. POWR also reminds you after 8 workouts
              without a backup.
            </Trans>
          }
          value={choice}
          onChange={choose}
          options={[
            {
              value: 'auto',
              label: t`Automatic: every ${autoDays} days`,
              description: unprotected ? (
                <Trans>7 days while the storage is not protected, otherwise 14.</Trans>
              ) : (
                <Trans>14 days, or 7 while the storage is not protected.</Trans>
              ),
            },
            { value: '7', label: t`Every 7 days` },
            { value: '14', label: t`Every 14 days` },
            { value: '30', label: t`Every 30 days` },
            { value: 'off', label: t`Off` },
          ]}
        />
      )}
    </Card>
  );
}

/** Restore: validate fully, preview, typed confirmation, then one atomic replace-all (DAT-06). */
function RestoreCard() {
  const { t } = useLingui();
  const importer = useImportBackup();
  const [backup, setBackup] = useState<DecodedBackup | null>(null);
  const [error, setError] = useState<BackupError | null>(null);
  const [confirmation, setConfirmation] = useState('');
  const [state, setState] = useState<'idle' | 'checking' | 'restoring' | 'failed'>('idle');
  const [done, setDone] = useState('');
  const confirmWord = t`REPLACE`;

  const pick = async (file: File | undefined) => {
    setBackup(null);
    setError(null);
    setDone('');
    if (!file) return;
    setState('checking');
    const result = await importer.preview(file);
    setState('idle');
    if (result.ok) setBackup(result.value);
    else setError(result.error);
  };

  const apply = async () => {
    if (!backup) return;
    setState('restoring');
    try {
      const result = await importer.apply(backup);
      const sets = result.counts.sets;
      setDone(
        plural(sets, { one: 'Restored. # set imported.', other: 'Restored. # sets imported.' }),
      );
      setBackup(null);
      setConfirmation('');
      setState('idle');
    } catch {
      setState('failed');
    }
  };

  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Restore from a backup</Trans>
      </h2>
      <label className="flex flex-col gap-2 text-sm text-fg-muted">
        {t`Choose a POWR backup file (.zip)`}
        <input
          type="file"
          accept=".zip,application/zip"
          data-testid="restore-file"
          onChange={(event) => void pick(event.target.files?.[0])}
          className="min-h-target text-sm file:mr-3 file:min-h-target file:rounded-xl file:border file:border-control file:bg-surface file:px-3"
        />
      </label>

      {error ? (
        <p role="alert" data-testid="restore-error" className="text-danger">
          <BackupErrorMessage error={error} />
        </p>
      ) : null}

      {backup ? (
        <div data-testid="restore-preview" className="flex flex-col gap-3">
          <dl className="grid grid-cols-2 gap-1 text-sm tabular">
            <dt className="text-fg-muted">
              <Trans>Created</Trans>
            </dt>
            <dd>{formatDateTime(Date.parse(backup.preview.createdAt))}</dd>
            <dt className="text-fg-muted">
              <Trans>Workouts</Trans>
            </dt>
            <dd>{backup.preview.counts.sessions}</dd>
            <dt className="text-fg-muted">
              <Trans>Sets</Trans>
            </dt>
            <dd>{backup.preview.counts.sets}</dd>
            <dt className="text-fg-muted">
              <Trans>Training days</Trans>
            </dt>
            <dd>
              {backup.preview.dateRange.from ?? '-'} – {backup.preview.dateRange.to ?? '-'}
            </dd>
          </dl>
          <p className="text-sm">
            <Plural
              value={backup.preview.counts.sets}
              one="Restoring replaces all data on this phone with this backup (# set). A safety copy of the current data is kept."
              other="Restoring replaces all data on this phone with this backup (# sets). A safety copy of the current data is kept."
            />
          </p>
          <label className="flex flex-col gap-1 text-sm">
            {t`Type ${confirmWord} to confirm`}
            <Input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              data-testid="restore-confirm"
            />
          </label>
          <Button
            variant="danger"
            disabled={confirmation !== confirmWord || state === 'restoring'}
            onClick={() => void apply()}
          >
            <Trans>Replace all data</Trans>
          </Button>
        </div>
      ) : null}

      <output data-testid="restore-status" className="block text-sm empty:hidden">
        {state === 'checking' ? <Trans>Checking the file…</Trans> : null}
        {state === 'restoring' ? <Trans>Restoring…</Trans> : null}
        {state === 'failed' ? (
          <Trans>The restore did not complete. Nothing was changed.</Trans>
        ) : null}
        {done}
      </output>
    </Card>
  );
}

/** Every rejection says what happened and that nothing changed (DAT-06, NFR-USE-04). */
function BackupErrorMessage({ error }: { error: BackupError }) {
  const { t } = useLingui();
  const notBackup = t`This is not a POWR backup file. Nothing was changed.`;
  const unsafe = t`This file is too large or malformed to restore safely. Nothing was changed.`;
  const invalid = t`This backup contains invalid data, so it cannot be restored. Nothing was changed.`;
  const messages: Record<BackupError['kind'], string> = {
    newerVersion: t`This backup was made by a newer version of POWR. Update the app first.`,
    checksumMismatch: t`This backup is damaged or was edited, so it cannot be restored. Nothing was changed.`,
    notZip: notBackup,
    notAPowrBackup: notBackup,
    tooLarge: unsafe,
    unsafeArchive: unsafe,
    invalidManifest: invalid,
    invalidData: invalid,
    brokenReference: invalid,
  };
  return messages[error.kind];
}

/**
 * Safety copies (§8.2.1, TD-14): the backups POWR took before a restore and before a data update.
 * Each can be saved as a file or deleted; the latest two and any younger than 30 days are kept,
 * never more than five (TD-67, M6c; `pruneSafetyCopies` runs when the list loads).
 */
function SafetyCopiesCard() {
  const { t } = useLingui();
  const { copies, save, remove } = useSafetyCopies();
  const [status, setStatus] = useState('');
  const [deleting, setDeleting] = useState<SafetySnapshotInfo | null>(null);
  const headingId = useId();
  const heading = useRef<HTMLHeadingElement>(null);
  if (copies === null) return null;

  const saveCopy = async (copy: SafetySnapshotInfo) => {
    const result = await save(copy.id);
    const name = copy.fileName;
    setStatus(result.ok ? t`Saved to Downloads as ${name}.` : t`Not saved.`);
  };
  const confirmDelete = async () => {
    if (!deleting) return;
    await remove(deleting.id);
    setDeleting(null);
    setStatus(t`Safety copy deleted.`);
    heading.current?.focus();
  };

  return (
    <Card>
      <h2 ref={heading} id={headingId} tabIndex={-1} className="text-lg font-semibold outline-none">
        <Trans>Safety copies</Trans>
      </h2>
      <p className="text-sm text-fg-muted">
        <Trans>
          POWR saves your data by itself before a restore replaces it and before an update changes
          how it is stored. It keeps the latest two copies and any from the last 30 days, never more
          than five, and deletes the oldest ones by itself.
        </Trans>
      </p>
      {copies.length === 0 ? (
        <p data-testid="safety-copies-empty" className="text-sm">
          <Trans>No safety copies yet.</Trans>
        </p>
      ) : (
        <ul aria-labelledby={headingId} className="flex flex-col gap-3">
          {copies.map((copy) => {
            const when = formatDateTime(Date.parse(copy.at));
            const size = formatBytes(copy.size);
            const label =
              copy.reason === 'migration'
                ? t`Before a data update, ${when}`
                : t`Before a restore, ${when}`;
            return (
              <li
                key={copy.id}
                data-testid="safety-copy"
                className="flex flex-col gap-2 rounded-xl border border-border p-3"
              >
                <p className="font-semibold">{label}</p>
                <p className="text-sm text-fg-muted">{size}</p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void saveCopy(copy)} aria-label={t`Save: ${label}`}>
                    <Trans>Save</Trans>
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setDeleting(copy)}
                    aria-label={t`Delete: ${label}`}
                  >
                    <Trash2 aria-hidden="true" className="size-5" />
                    <Trans>Delete</Trans>
                  </Button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <output data-testid="safety-copies-status" className="block text-sm empty:hidden">
        {status}
      </output>
      <Sheet
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
        title={t`Delete this safety copy?`}
        closeLabel={t`Close`}
      >
        <p>
          <Trans>
            It cannot be restored afterwards. Your current data and your own backup files are not
            affected.
          </Trans>
        </p>
        <Button variant="danger" size="lg" onClick={() => void confirmDelete()}>
          <Trans>Delete the safety copy</Trans>
        </Button>
        <Button size="lg" onClick={() => setDeleting(null)}>
          <Trans>Keep it</Trans>
        </Button>
      </Sheet>
    </Card>
  );
}

/**
 * "Verify data" (M4b, §8.2.8): rebuilds the derived weeks and the streak from the raw records
 * (`rebuildInsights`), for when a number looks off. Nothing raw is changed; logging stays usable.
 */
function VerifyCard() {
  const run = useInsights();
  const [state, setState] = useState<
    | { readonly kind: 'idle' }
    | { readonly kind: 'busy' }
    | { readonly kind: 'done'; readonly report: InsightsReport }
    | { readonly kind: 'failed' }
  >({ kind: 'idle' });
  const verify = async () => {
    setState({ kind: 'busy' });
    try {
      const report = await run((insights, deps) => insights.rebuildInsights(deps));
      setState({ kind: 'done', report });
    } catch {
      setState({ kind: 'failed' });
    }
  };
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Verify data</Trans>
      </h2>
      <p className="text-sm text-fg-muted">
        <Trans>
          Recalculates your weekly volume, heat map and streak from your logged workouts. Use it if
          a number looks off. Your workouts are not changed.
        </Trans>
      </p>
      <Button size="lg" disabled={state.kind === 'busy'} onClick={() => void verify()}>
        <Trans>Verify data</Trans>
      </Button>
      <output data-testid="verify-status" className="block empty:hidden">
        {state.kind === 'busy' ? <Trans>Checking your data…</Trans> : null}
        {state.kind === 'done' ? (
          <Plural
            value={state.report.rebuiltWeeks}
            one="Done: # week recalculated, and your streak is up to date."
            other="Done: # weeks recalculated, and your streak is up to date."
          />
        ) : null}
        {state.kind === 'failed' ? (
          <Trans>That did not work. Your workouts are safe; try again later.</Trans>
        ) : null}
      </output>
    </Card>
  );
}

/**
 * DAT-13: delete everything, after an offer to export first and a typed confirmation in a sheet
 * (two steps). Every database goes, including the safety copies and the diagnostics; the app
 * then starts again at the first-run onboarding.
 */
function DeleteAllCard() {
  const { t } = useLingui();
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const { state: exportState, run: exportFirst } = useExport();
  const deleteAll = useDeleteAllData();
  const session = useActiveSession();
  const confirmWord = t`DELETE`;
  const workoutActive = session.loaded && session.value !== undefined;

  const confirm = async () => {
    // The deletion screen replaces the app at once: load its chunk before anything unmounts.
    await import('./DataDeletedScreen');
    await deleteAll();
  };

  return (
    <Card className="border-2 border-danger">
      <h2 className="text-lg font-semibold">
        <Trans>Delete all data</Trans>
      </h2>
      <p className="text-sm">
        <Trans>
          Deletes every workout, plan, setting, safety copy and the diagnostics from this phone,
          then POWR starts again as on the first day. This cannot be undone.
        </Trans>
      </p>
      <Button size="lg" onClick={() => setOpen(true)} variant="danger">
        <Trash2 aria-hidden="true" className="size-5" />
        <Trans>Delete all data…</Trans>
      </Button>
      <Sheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setConfirmation('');
        }}
        title={t`Delete all data?`}
        description={t`Everything POWR stored on this phone is deleted. Backup files you saved elsewhere are not affected.`}
        closeLabel={t`Close`}
      >
        {workoutActive ? (
          <p className="font-semibold">
            <Trans>Your workout in progress is deleted too.</Trans>
          </p>
        ) : null}
        <p>
          <Trans>Export a backup first if you might want this data again.</Trans>
        </p>
        <Button
          variant="primary"
          size="lg"
          disabled={exportState.kind === 'busy'}
          onClick={() => void exportFirst()}
        >
          <Trans>Export a backup first</Trans>
        </Button>
        <ExportStatus state={exportState} testId="delete-export-status" />
        <label className="flex flex-col gap-1">
          {t`Type ${confirmWord} to confirm`}
          <Input
            value={confirmation}
            onChange={(event) => setConfirmation(event.target.value)}
            autoCapitalize="characters"
            autoComplete="off"
            data-testid="delete-confirm"
          />
        </label>
        <Button
          variant="danger"
          size="lg"
          disabled={confirmation.trim() !== confirmWord}
          onClick={() => void confirm()}
        >
          <Trans>Delete everything</Trans>
        </Button>
        <Button size="lg" onClick={() => setOpen(false)}>
          <Trans>Cancel</Trans>
        </Button>
      </Sheet>
    </Card>
  );
}
