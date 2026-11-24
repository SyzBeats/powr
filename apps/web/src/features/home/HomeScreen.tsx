import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { CircleCheck, CloudOff } from 'lucide-react';

import type { Session } from '@powr/domain';

import { Card, Screen } from '#ui/screen';

import { useOfflineReady } from '../../hooks/use-app';
import { useActiveSession, useSessionSets } from '../../hooks/use-session';

const linkButtonClass =
  'flex min-h-target-lg w-full items-center justify-center rounded-xl px-4 text-lg font-semibold';

export function HomeScreen() {
  const { t } = useLingui();
  const session = useActiveSession();
  const offlineReady = useOfflineReady();

  return (
    <Screen title={t`Home`}>
      <p data-testid="offline-status" className="flex items-center gap-2 text-sm text-fg-muted">
        {offlineReady ? (
          <>
            <CircleCheck aria-hidden="true" className="size-4 text-success" />
            <Trans>Ready for offline use</Trans>
          </>
        ) : (
          <>
            <CloudOff aria-hidden="true" className="size-4" />
            <Trans>Preparing offline use…</Trans>
          </>
        )}
      </p>

      {session.loaded && session.value ? (
        <ActiveSessionCard session={session.value} />
      ) : (
        <Card>
          <p>
            <Trans>Log your first set. Everything stays on this phone.</Trans>
          </p>
          <Link to="/session" className={`${linkButtonClass} bg-primary text-on-primary`}>
            <Trans>Log a set</Trans>
          </Link>
        </Card>
      )}

      <Card>
        <p className="text-fg-muted">
          <Trans>New phone? Restore your training data from a backup file.</Trans>
        </p>
        <Link to="/data" className={`${linkButtonClass} border border-border`}>
          <Trans>Restore from a backup</Trans>
        </Link>
      </Card>
    </Screen>
  );
}

function ActiveSessionCard({ session }: { session: Session }) {
  const sets = useSessionSets(session.id);
  const count = sets.loaded ? sets.value.length : 0;
  return (
    <Card>
      <p className="font-semibold">
        <Trans>Workout in progress</Trans>
      </p>
      <p className="text-fg-muted">
        <Plural value={count} one="# set logged" other="# sets logged" />
      </p>
      <Link to="/session" className={`${linkButtonClass} bg-primary text-on-primary`}>
        <Trans>Continue workout</Trans>
      </Link>
    </Card>
  );
}
