import { Trans } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';

import { buttonClass } from '#ui/button-class';

import { useAppUpdate, useStaleWindow } from '../../hooks/use-app';
import { useActiveSession } from '../../hooks/use-session';

/**
 * Non-blocking update notice (PWA-04); never applies an update during a workout. Part of the shell,
 * so on the startup path: native buttons with the design system's classes, not Base UI's (TD-63).
 */
export function UpdateBanner() {
  const { updateAvailable, applyUpdate } = useAppUpdate();
  const stale = useStaleWindow();
  const session = useActiveSession();
  if (stale) return <StaleWindowBanner />;
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
        <div className="flex flex-wrap items-center gap-2">
          {/* NFR-MNT-07, SET-09 (M6c): the release notes, with the waiting update's when online. */}
          <Link to="/settings/whats-new" className={buttonClass({ variant: 'secondary' })}>
            <Trans>What's new</Trans>
          </Link>
          <button
            type="button"
            className={buttonClass({ variant: 'primary' })}
            disabled={sessionActive}
            onClick={applyUpdate}
          >
            <Trans>Update</Trans>
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * §6.8, TD-14: another window updated (or deleted) the database, so this window let go of it and
 * must reload before it can read or save anything again.
 */
function StaleWindowBanner() {
  return (
    <div className="border-b-2 border-warning bg-surface-raised">
      <div className="mx-auto flex max-w-xl items-center justify-between gap-3 px-4 py-2">
        <p role="alert" data-testid="stale-window" className="text-sm">
          <Trans>POWR was updated in another window. Reload to continue.</Trans>
        </p>
        <button
          type="button"
          className={buttonClass({ variant: 'primary' })}
          onClick={() => location.reload()}
        >
          <Trans>Reload</Trans>
        </button>
      </div>
    </div>
  );
}
