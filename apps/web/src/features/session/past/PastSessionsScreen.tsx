import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';
import { useEffect, useState } from 'react';

import type { PastSessionSummary } from '@powr/application/session';

import { Badge } from '#ui/badge';
import { buttonClass } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { useSessionUseCases } from '../../../hooks/use-workout';
import { formatLocalDate, formatMinutes } from '../../../i18n/format';
import { useLabels } from '../../labels';

/** How many exercise names a row shows before "and N more". */
const NAMES_SHOWN = 3;

/**
 * WKT-15: a minimal list of past sessions (the last year, newest first), each opening the
 * editor, and the way to log a session for a past date. History and analytics are M4.
 */
export function PastSessionsScreen() {
  const { t } = useLingui();
  const run = useSessionUseCases();
  const [sessions, setSessions] = useState<readonly PastSessionSummary[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    void run((session, deps) => session.listPastSessions(deps, { days: 365 })).then((list) => {
      if (!cancelled) setSessions(list);
    });
    return () => {
      cancelled = true;
    };
  }, [run]);

  return (
    <Screen title={t`Past sessions`}>
      <Link to="/session/past/new" className={buttonClass({ variant: 'primary', size: 'lg' })}>
        <Trans>Log a past workout</Trans>
      </Link>
      {sessions === null ? (
        <output className="block text-fg-muted">
          <Trans>Loading your workouts…</Trans>
        </output>
      ) : sessions.length === 0 ? (
        <Card>
          <p>
            <Trans>
              No finished workouts in the last year yet. Workouts you finish, and workouts you log
              for a past date, show here.
            </Trans>
          </p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2" data-testid="past-sessions">
          {sessions.map((entry) => (
            <li key={entry.session.id}>
              <PastSessionRow entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </Screen>
  );
}

function PastSessionRow({ entry }: { entry: PastSessionSummary }) {
  const { t } = useLingui();
  const labels = useLabels();
  const { session } = entry;
  const date = formatLocalDate(session.localDate, 'long');
  const minutes = session.endedAt
    ? Math.round((session.endedAt.epochMs - session.startedAt.epochMs) / 60_000)
    : null;
  const names = entry.exerciseIds.slice(0, NAMES_SHOWN).map((id) => labels.exercise(id));
  const more = entry.exerciseIds.length - names.length;
  const shown = names.join(', ');
  return (
    <Link
      to="/session/past/$sessionId"
      params={{ sessionId: session.id }}
      className="flex min-h-target items-center gap-3 rounded-2xl border border-control bg-surface p-3"
    >
      <span className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {date}
          {session.status === 'partial' ? <Badge tone="neutral">{t`Partial`}</Badge> : null}
          {session.backdated ? <Badge tone="info">{t`Logged later`}</Badge> : null}
        </span>
        <span className="text-sm text-fg-muted">
          <Plural value={entry.doneSets} one="# set" other="# sets" />
          {minutes !== null && minutes > 0 && !session.backdated ? (
            <>
              {' · '}
              {formatMinutes(minutes)}
            </>
          ) : null}
        </span>
        {names.length > 0 ? (
          <span className="text-sm">
            {more > 0 ? (
              <Trans>
                {shown} and {more} more
              </Trans>
            ) : (
              shown
            )}
          </span>
        ) : null}
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
    </Link>
  );
}
