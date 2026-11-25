import { Trans, useLingui } from '@lingui/react/macro';
import { useState } from 'react';

import { Button } from '#ui/button';

/**
 * Why the app could not start with its data (§6.8, DAT-14):
 * - `upgrade`: the data update (migration) failed and was rolled back;
 * - `snapshot`: the safety copy before the update could not be saved, so the update did not run;
 * - `open`: the database could not be opened (corruption, another window holds an old version).
 */
export type RecoveryKind = 'upgrade' | 'snapshot' | 'open';

export type CopyOutcome =
  | { readonly kind: 'saved'; readonly fileName: string }
  | { readonly kind: 'cancelled' | 'unreadable' | 'failed' };

/**
 * The recovery screen (DAT-14, §6.8). Rendered by the boot sequence when the data cannot be
 * opened, outside the router and without the container. Data is never deleted automatically: it
 * offers a copy of the raw data as a backup file, the diagnostics file for a bug report, and
 * trying again.
 */
export function RecoveryScreen({
  kind,
  onSaveCopy,
  onExportDiagnostics,
  onRetry,
}: {
  kind: RecoveryKind;
  onSaveCopy: () => Promise<CopyOutcome>;
  onExportDiagnostics: () => Promise<string>;
  onRetry: () => void;
}) {
  const { t } = useLingui();
  const [copy, setCopy] = useState<CopyOutcome | 'busy' | null>(null);
  const [diagnostics, setDiagnostics] = useState<
    | { readonly kind: 'busy' | 'failed' }
    | { readonly kind: 'saved'; readonly fileName: string }
    | null
  >(null);

  const saveCopy = async () => {
    setCopy('busy');
    try {
      setCopy(await onSaveCopy());
    } catch {
      setCopy({ kind: 'failed' });
    }
  };
  const exportDiagnostics = async () => {
    setDiagnostics({ kind: 'busy' });
    try {
      setDiagnostics({ kind: 'saved', fileName: await onExportDiagnostics() });
    } catch {
      setDiagnostics({ kind: 'failed' });
    }
  };

  const title =
    kind === 'upgrade'
      ? t`POWR could not update your data`
      : kind === 'snapshot'
        ? t`POWR could not make a safety copy`
        : t`POWR could not open its data`;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-5 p-6 pt-safe">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p>
        {kind === 'upgrade' ? (
          <Trans>
            This version of POWR stores your data in a new way, and updating it failed. The update
            was undone: your data is still stored exactly as before.
          </Trans>
        ) : kind === 'snapshot' ? (
          <Trans>
            Before it updates how your data is stored, POWR saves a safety copy. That copy could not
            be saved, so the update did not run. Your data has not been changed.
          </Trans>
        ) : (
          <Trans>Your data has not been changed. Close other POWR windows, then try again.</Trans>
        )}
      </p>
      <p className="text-fg-muted">
        <Trans>
          Nothing is deleted automatically. Save a copy of your data now; a fixed version of POWR
          can restore it.
        </Trans>
      </p>

      <section aria-labelledby="recovery-copy" className="flex flex-col gap-2">
        <h2 id="recovery-copy" className="text-lg font-semibold">
          <Trans>Keep a copy</Trans>
        </h2>
        <Button
          variant="primary"
          size="lg"
          disabled={copy === 'busy'}
          onClick={() => void saveCopy()}
        >
          <Trans>Save a copy of your data</Trans>
        </Button>
        <output data-testid="recovery-copy-status" className="block text-sm empty:hidden">
          {copy === 'busy' ? <Trans>Reading your data…</Trans> : null}
          {copy !== null && copy !== 'busy' && copy.kind === 'saved' ? (
            <Trans>
              Saved to Downloads as {copy.fileName}. Copy it off the phone, for example to cloud
              storage.
            </Trans>
          ) : null}
          {copy !== null && copy !== 'busy' && copy.kind === 'cancelled' ? (
            <Trans>Not saved.</Trans>
          ) : null}
          {copy !== null &&
          copy !== 'busy' &&
          (copy.kind === 'unreadable' || copy.kind === 'failed') ? (
            <Trans>
              The data could not be read. It has not been deleted; export the diagnostics and try
              again after an update.
            </Trans>
          ) : null}
        </output>
      </section>

      <section aria-labelledby="recovery-report" className="flex flex-col gap-2">
        <h2 id="recovery-report" className="text-lg font-semibold">
          <Trans>Report the problem</Trans>
        </h2>
        <p className="text-sm text-fg-muted">
          <Trans>
            The diagnostics file lists what went wrong on this phone. It contains no training data.
          </Trans>
        </p>
        <Button
          size="lg"
          disabled={diagnostics?.kind === 'busy'}
          onClick={() => void exportDiagnostics()}
        >
          <Trans>Export diagnostics</Trans>
        </Button>
        <output data-testid="recovery-diagnostics-status" className="block text-sm empty:hidden">
          {diagnostics?.kind === 'busy' ? <Trans>Preparing the file…</Trans> : null}
          {diagnostics?.kind === 'failed' ? (
            <Trans>The diagnostics could not be exported.</Trans>
          ) : null}
          {diagnostics?.kind === 'saved' ? (
            <Trans>Saved to Downloads as {diagnostics.fileName}.</Trans>
          ) : null}
        </output>
      </section>

      <Button size="lg" onClick={onRetry}>
        <Trans>Try again</Trans>
      </Button>
    </main>
  );
}

/** The blocking screen while the safety copy is written before a data update (§6.7 step 3). */
export function UpdatingDataScreen() {
  return (
    <main
      aria-busy="true"
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 pt-safe"
    >
      <h1 className="text-2xl font-semibold">
        <Trans>Updating your data…</Trans>
      </h1>
      <p className="text-fg-muted">
        <Trans>
          This version of POWR stores your data in a new way. It saves a safety copy first. Keep the
          app open; this takes a few seconds.
        </Trans>
      </p>
    </main>
  );
}
