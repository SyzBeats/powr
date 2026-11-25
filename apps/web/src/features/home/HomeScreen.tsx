import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { CalendarDays, CircleCheck, CloudOff } from 'lucide-react';

import type { LocalDate, Session } from '@powr/domain';

import { Card, Screen } from '#ui/screen';

import { useOfflineReady } from '../../hooks/use-app';
import { useActivePlan, usePlannedSessions } from '../../hooks/use-planning';
import { useActiveSession, useSessionSets } from '../../hooks/use-session';
import { addLocalDays, formatLocalDate, todayLocal } from '../../i18n/format';

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

      <NextPlannedCard />

      <Card>
        <p className="text-fg-muted">
          <Trans>New phone? Restore your training data from a backup file.</Trans>
        </p>
        <Link to="/data" className={`${linkButtonClass} border border-control`}>
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

/** The next planned session (PLN-11), or the entry point when no plan is set up (M2b). */
function NextPlannedCard() {
  const plan = useActivePlan();
  const today = todayLocal();
  const sessions = usePlannedSessions(today as LocalDate, addLocalDays(today, 21) as LocalDate);
  if (!plan.loaded) return null;
  if (!plan.value) {
    return (
      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Plan not set up</Trans>
        </h2>
        <p className="text-fg-muted">
          <Trans>Get a plan for your days, time and equipment, with every choice explained.</Trans>
        </p>
        <Link
          to="/plan/setup/$step"
          params={{ step: 'goal' }}
          className={`${linkButtonClass} border border-control`}
        >
          <Trans>Set up a plan</Trans>
        </Link>
      </Card>
    );
  }
  const next = sessions.loaded
    ? sessions.value.find((session) => session.status === 'planned')
    : undefined;
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <CalendarDays aria-hidden="true" />
        <Trans>Next planned session</Trans>
      </h2>
      {next ? (
        <p data-testid="next-session">
          <span className="font-semibold">{next.name.en}</span>
          {' · '}
          {next.localDate === today ? (
            <Trans>today</Trans>
          ) : (
            formatLocalDate(next.localDate, 'long')
          )}
        </p>
      ) : (
        <p className="text-fg-muted">
          <Trans>Nothing planned in the next three weeks.</Trans>
        </p>
      )}
      {next && next.localDate === today ? (
        // WKT-01: today's planned session in one tap (the session route starts it).
        <Link
          to="/session"
          search={{ start: 'today' }}
          className={`${linkButtonClass} bg-primary text-on-primary`}
        >
          <Trans>Start today's session</Trans>
        </Link>
      ) : null}
      <Link to="/plan" className={`${linkButtonClass} border border-control`}>
        <Trans>Open the plan</Trans>
      </Link>
    </Card>
  );
}
