import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link, useNavigate } from '@tanstack/react-router';
import { CalendarDays, History, Play, Repeat } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import type { PastSessionSummary, StartSource } from '@powr/application/session';
import type { LocalDate, PlannedSession } from '@powr/domain';

import { Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { useActivePlan, usePlannedSessions } from '../../hooks/use-planning';
import { useSessionUseCases } from '../../hooks/use-workout';
import { addLocalDays, formatLocalDate, todayLocal } from '../../i18n/format';
import { useLabels } from '../labels';
import { useSessionCommands } from './commands';

/**
 * WKT-01: start today's planned session in one tap, another planned session of the week, an
 * empty freestyle session, or a repeat of a past one. The tap that starts also unlocks audio.
 * Deload and return-from-break days say so before the start; the check-in and the proposals
 * follow once the session exists (RDY-01…03, PRG-13). With `startToday` (Home's "Start today's
 * session", `?start=today`) today's planned session starts at once, one tap from Home.
 */
export function StartScreen({ startToday = false }: { startToday?: boolean }) {
  const { t } = useLingui();
  const labels = useLabels();
  const { start } = useSessionCommands();
  const run = useSessionUseCases();
  const plan = useActivePlan();
  const today = todayLocal() as LocalDate;
  const week = usePlannedSessions(today, addLocalDays(today, 6) as LocalDate);
  const [recent, setRecent] = useState<readonly PastSessionSummary[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void run((session, deps) => session.listPastSessions(deps, { days: 60, limit: 3 })).then(
      (list) => {
        if (!cancelled) setRecent(list);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [run]);

  const begin = async (source: StartSource) => {
    setBusy(true);
    setError(null);
    const outcome = await start(source);
    setBusy(false);
    if (!outcome.ok) {
      setError(
        outcome.error.kind === 'activeSession'
          ? t`A workout is already running. Continue it or finish it first.`
          : t`This session could not be started. Try again.`,
      );
    }
  };

  const planned = week.loaded ? week.value.filter((session) => session.status === 'planned') : [];
  const todays = planned.filter((session) => session.localDate === today);
  const later = planned.filter((session) => session.localDate !== today);

  // WKT-01 one tap from Home: start today's session once, then drop the parameter (a reload or
  // Back never starts a second one; without a session today the start screen just shows).
  const navigate = useNavigate();
  const autoStarted = useRef(false);
  const todayId = todays[0]?.id ?? null;
  useEffect(() => {
    if (!startToday || !week.loaded || autoStarted.current) return;
    autoStarted.current = true;
    void navigate({ to: '/session', search: {}, replace: true });
    // After this effect (the start sets the busy state): an external trigger, like a tap.
    if (todayId) queueMicrotask(() => void begin({ kind: 'planned', plannedSessionId: todayId }));
  });

  return (
    <Screen title={t`Start a workout`}>
      {error ? (
        <Callout tone="danger" title={t`Not started`}>
          <p>{error}</p>
        </Callout>
      ) : null}

      {plan.loaded && plan.value ? (
        todays.length > 0 ? (
          todays.map((session) => (
            <PlannedCard
              key={session.id}
              session={session}
              primary
              busy={busy}
              onStart={() => void begin({ kind: 'planned', plannedSessionId: session.id })}
            />
          ))
        ) : (
          <Card>
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <CalendarDays aria-hidden="true" />
              <Trans>Rest day</Trans>
            </h2>
            <p className="text-fg-muted">
              <Trans>
                Nothing is planned for today. You can start a session of this week early.
              </Trans>
            </p>
          </Card>
        )
      ) : plan.loaded ? (
        <Card>
          <h2 className="text-lg font-bold">
            <Trans>Plan not set up</Trans>
          </h2>
          <p className="text-fg-muted">
            <Trans>Log freely, or get a plan for your days, time and equipment.</Trans>
          </p>
          <Link to="/plan/setup/$step" params={{ step: 'goal' }} className={buttonClass()}>
            <Trans>Set up a plan</Trans>
          </Link>
        </Card>
      ) : null}

      <Card>
        <h2 className="text-lg font-bold">
          <Trans>Freestyle</Trans>
        </h2>
        <p className="text-fg-muted">
          <Trans>Start an empty workout and add exercises as you go.</Trans>
        </p>
        <Button
          variant={todays.length > 0 ? 'secondary' : 'primary'}
          size="lg"
          disabled={busy}
          onClick={() => void begin({ kind: 'freestyle', exerciseIds: [] })}
        >
          <Play aria-hidden="true" />
          <Trans>Start an empty workout</Trans>
        </Button>
      </Card>

      {later.length > 0 ? (
        <section aria-labelledby="later-sessions" className="flex flex-col gap-2">
          <h2 id="later-sessions" className="text-lg font-bold">
            <Trans>Later this week</Trans>
          </h2>
          {later.map((session) => (
            <PlannedCard
              key={session.id}
              session={session}
              busy={busy}
              onStart={() => void begin({ kind: 'planned', plannedSessionId: session.id })}
            />
          ))}
        </section>
      ) : null}

      {recent && recent.length > 0 ? (
        <section aria-labelledby="repeat-sessions" className="flex flex-col gap-2">
          <h2 id="repeat-sessions" className="text-lg font-bold">
            <Trans>Repeat a past workout</Trans>
          </h2>
          {recent.map((entry) => {
            const date = formatLocalDate(entry.session.localDate, 'long');
            const names = entry.exerciseIds.slice(0, 3).map((id) => labels.exercise(id));
            const more = entry.exerciseIds.length - names.length;
            return (
              <Card key={entry.session.id} className="gap-2">
                <p className="font-semibold">{date}</p>
                <p className="text-sm text-fg-muted">
                  {names.join(', ')}
                  {more > 0 ? (
                    <>
                      {' '}
                      <Plural value={more} one="and # more" other="and # more" />
                    </>
                  ) : null}
                </p>
                <Button
                  disabled={busy}
                  aria-label={t`Repeat the workout of ${date}`}
                  onClick={() => void begin({ kind: 'repeat', sessionId: entry.session.id })}
                >
                  <Repeat aria-hidden="true" />
                  <Trans>Repeat</Trans>
                </Button>
              </Card>
            );
          })}
        </section>
      ) : null}

      <Link to="/session/past" className={buttonClass({ variant: 'ghost' }, 'justify-start')}>
        <History aria-hidden="true" />
        <Trans>Past sessions</Trans>
      </Link>
    </Screen>
  );
}

/** A planned session with its adjustments in words and its start button. */
function PlannedCard({
  session,
  primary = false,
  busy,
  onStart,
}: {
  session: PlannedSession;
  primary?: boolean;
  busy: boolean;
  onStart: () => void;
}) {
  const { t } = useLingui();
  const labels = useLabels();
  const name = session.name.en;
  const date = formatLocalDate(session.localDate, 'long');
  return (
    <Card>
      <h2 className={primary ? 'text-xl font-bold' : 'text-lg font-semibold'}>{name}</h2>
      <p className="text-sm text-fg-muted">
        {date}
        {' · '}
        <Plural value={session.slots.length} one="# exercise" other="# exercises" />
      </p>
      <p className="text-sm">
        {session.slots.map((slot) => labels.exercise(slot.exerciseId)).join(', ')}
      </p>
      {session.adjustments.map((adjustment, index) => (
        <Callout key={index} tone="info">
          {adjustment.kind === 'deload' ? (
            <Trans>
              Lighter week: fewer sets and more reps in reserve, so you recover and come back
              stronger.
            </Trans>
          ) : adjustment.kind === 'returnFromBreak' ? (
            <Trans>
              Easing back in after {adjustment.daysOff ?? 0} days off: lighter loads and fewer sets
              this time.
            </Trans>
          ) : adjustment.kind === 'mergedWork' ? (
            <Trans>Includes key work from a missed session.</Trans>
          ) : (
            <Trans>Calibration: start conservatively so POWR can learn your loads.</Trans>
          )}
        </Callout>
      ))}
      <Button
        variant={primary ? 'primary' : 'secondary'}
        size={primary ? 'lg' : 'md'}
        disabled={busy}
        aria-label={primary ? undefined : t`Start session: ${name}, ${date}`}
        onClick={onStart}
      >
        <Play aria-hidden="true" />
        <Trans>Start session</Trans>
      </Button>
    </Card>
  );
}
