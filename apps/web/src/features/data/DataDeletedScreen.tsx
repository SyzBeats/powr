import { Trans, useLingui } from '@lingui/react/macro';
import { useEffect, useRef } from 'react';

import { Button } from '#ui/button';

import { useWipeState } from '../../hooks/use-data';

/**
 * Shown in place of the whole app while "Delete all data" runs and after it (DAT-13): no route,
 * no live query, nothing that would open a database again. "Start again" reloads the app at its
 * start, which is the first-run onboarding (ONB-01) because nothing is stored any more.
 */
export default function DataDeletedScreen() {
  const { t } = useLingui();
  const wipe = useWipeState();
  const heading = useRef<HTMLHeadingElement>(null);
  const kind = wipe?.kind ?? 'deleting';
  const title =
    kind === 'deleting'
      ? t`Deleting your data…`
      : kind === 'done'
        ? t`All data deleted`
        : t`Some data could not be deleted`;

  useEffect(() => {
    document.title = t`${title} · POWR`;
    heading.current?.focus();
  }, [title, t]);

  return (
    <main
      aria-busy={kind === 'deleting'}
      className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 p-6 pt-safe"
    >
      <h1
        ref={heading}
        tabIndex={-1}
        data-testid="data-deleted-title"
        className="text-2xl font-semibold outline-none"
      >
        {title}
      </h1>
      {kind === 'done' ? (
        <p>
          <Trans>
            Your workouts, plans, settings, safety copies and diagnostics are gone from this phone.
            Backup files you saved elsewhere are not affected.
          </Trans>
        </p>
      ) : null}
      {kind === 'failed' ? (
        <p>
          <Trans>
            Another POWR window or tab may still be open. Close it, then tap Start again and delete
            the data once more.
          </Trans>
        </p>
      ) : null}
      {kind === 'deleting' ? null : (
        <Button variant="primary" size="lg" onClick={() => location.replace('/')}>
          <Trans>Start again</Trans>
        </Button>
      )}
    </main>
  );
}
