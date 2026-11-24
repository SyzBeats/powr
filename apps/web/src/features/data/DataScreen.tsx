import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import type { BackupError, DecodedBackup } from '@powr/formats';

import { useExportBackup, useImportBackup, useMeta, useStorageStatus } from '../../hooks/use-data';
import { formatBytes, formatDateTime } from '../../i18n/format';
import { Button } from '../../ui/button';
import { Card, Screen } from '../../ui/screen';

export function DataScreen() {
  const { t } = useLingui();
  return (
    <Screen title={t`Data and backups`}>
      <StorageCard />
      <ExportCard />
      <RestoreCard />
    </Screen>
  );
}

/** "Storage protected: Yes/No" with an explained, tap-initiated persist request (DAT-03). */
function StorageCard() {
  const { status, requestPersistence } = useStorageStatus();
  if (!status) return null;
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Storage</Trans>
      </h2>
      <p data-testid="storage-protected">
        {status.persisted ? (
          <Trans>Storage protected: Yes</Trans>
        ) : (
          <Trans>Storage protected: No</Trans>
        )}
      </p>
      {status.persisted ? null : (
        <>
          <p className="text-sm text-fg-muted">
            <Trans>
              Without protection the browser may delete POWR data when the phone runs low on space.
              Back up regularly either way: clearing site data or uninstalling deletes everything.
            </Trans>
          </p>
          <Button onClick={() => void requestPersistence()}>
            <Trans>Protect my data</Trans>
          </Button>
        </>
      )}
      {status.estimate ? (
        <p className="text-sm text-fg-muted">
          <Trans>
            Using {formatBytes(status.estimate.usage)} of {formatBytes(status.estimate.quota)}
          </Trans>
        </p>
      ) : null}
    </Card>
  );
}

function ExportCard() {
  const lastBackup = useMeta('lastBackup');
  const exportBackup = useExportBackup();
  const [message, setMessage] = useState('');
  const { t } = useLingui();

  const run = async () => {
    const result = await exportBackup();
    if (result.ok) {
      const name = result.value.fileName;
      setMessage(
        t`Saved to Downloads as ${name}. Copy it off the phone, for example to cloud storage.`,
      );
    }
  };

  const last = lastBackup.loaded
    ? (lastBackup.value?.value as { at?: string } | undefined)?.at
    : undefined;
  const lastText = last ? formatDateTime(Date.parse(last)) : null;

  return (
    <Card>
      <h2 className="text-lg font-semibold">
        <Trans>Backup</Trans>
      </h2>
      <p className="text-sm text-fg-muted">
        {lastText ? <Trans>Last backup: {lastText}</Trans> : <Trans>No backup yet.</Trans>}
      </p>
      <Button variant="primary" onClick={() => void run()}>
        <Trans>Export backup</Trans>
      </Button>
      <output data-testid="export-status" className="block text-sm">
        {message}
      </output>
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
  const [done, setDone] = useState('');
  const confirmWord = t`REPLACE`;

  const pick = async (file: File | undefined) => {
    setBackup(null);
    setError(null);
    setDone('');
    if (!file) return;
    const result = await importer.preview(file);
    if (result.ok) setBackup(result.value);
    else setError(result.error);
  };

  const apply = async () => {
    if (!backup) return;
    const result = await importer.apply(backup);
    const sets = result.counts.sets;
    setDone(t`Restored. ${sets} sets imported.`);
    setBackup(null);
    setConfirmation('');
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
          className="min-h-target text-sm file:mr-3 file:min-h-target file:rounded-xl file:border file:border-border file:bg-surface file:px-3"
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
            <input
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoCapitalize="characters"
              autoComplete="off"
              data-testid="restore-confirm"
              className="min-h-target rounded-xl border border-border bg-surface px-3"
            />
          </label>
          <Button
            variant="danger"
            disabled={confirmation !== confirmWord}
            onClick={() => void apply()}
          >
            <Trans>Replace all data</Trans>
          </Button>
        </div>
      ) : null}

      <output data-testid="restore-status" className="block text-sm">
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
