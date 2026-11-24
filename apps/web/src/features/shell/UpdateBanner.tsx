import { Trans } from '@lingui/react/macro';

import { Button } from '#ui/button';

import { useAppUpdate } from '../../hooks/use-app';
import { useActiveSession } from '../../hooks/use-session';

/** Non-blocking update notice (PWA-04); never applies an update during a workout. */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useAppUpdate();
  const session = useActiveSession();
  if (!updateAvailable) return null;
  const sessionActive = !session.loaded || session.value !== undefined;

  return (
    <div className="border-b border-border bg-surface-raised">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2">
        <output data-testid="update-banner" className="text-sm">
          {sessionActive ? (
            <Trans>A new version is ready. Finish your workout to update.</Trans>
          ) : (
            <Trans>A new version of POWR is ready.</Trans>
          )}
        </output>
        <Button variant="primary" disabled={sessionActive} onClick={applyUpdate}>
          <Trans>Update</Trans>
        </Button>
      </div>
    </div>
  );
}
