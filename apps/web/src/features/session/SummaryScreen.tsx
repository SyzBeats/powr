import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import { CalendarClock, ChevronRight, Flame, Trophy } from 'lucide-react';
import { lazy, Suspense, useEffect, useState } from 'react';

import type { LocalDate, SessionId } from '@powr/domain';
import type { SessionSummary } from '@powr/domain/session';

import { announce } from '#ui/announcer';
import { Badge, Callout } from '#ui/badge';
import { Button, buttonClass } from '#ui/button';
import { cn } from '#ui/cn';
import { Card, Screen } from '#ui/screen';

import { useInsight } from '../../hooks/use-insights';
import { usePlanning } from '../../hooks/use-planning';
import { useDisplayPreferences } from '../../hooks/use-settings';
import { useSessionUseCases } from '../../hooks/use-workout';
import {
  formatLocalDate,
  formatMinutes,
  formatTime,
  todayLocal,
  addLocalDays,
} from '../../i18n/format';
import { BackupReminder } from '../data/BackupReminder';
import { useHeatSentence, useStreakWords } from '../insights/words';
import { useLabels } from '../labels';
import { InstallPromotion } from '../shell/InstallPromotion';
import { WhyButton } from '../why/WhySheet';
import { useSummaryWords } from './past/parts';
import { useSessionUi } from './session-ui';
import { massFromKg, useLoadUnit, useSessionWords } from './words';

/** The body-map artwork stays off the startup path: the mini heat map is its own chunk. */
const MiniHeatMap = lazy(() => import('../insights/MiniHeatMap'));

/** The calendar day a session started on, in the zone it was logged in (no Temporal here). */
function sessionDay(summary: SessionSummary): string {
  const { epochMs, offsetMin } = summary.startedAt;
  return new Date(epochMs + offsetMin * 60_000).toISOString().slice(0, 10);
}

/**
 * WKT-13 and MOT-02: the summary of a finished (or partial) session: duration, sets done
 * against the plan, PRs with a short celebration (static under reduced motion), e1RM changes,
 * volume per muscle, the streak, the note and the accepted changes; after a finish also the
 * reactive-deload check (PRG-12). Works for any past session, so a reload shows it again.
 */
export function SummaryScreen({ sessionId }: { sessionId: SessionId }) {
  const { t } = useLingui();
  const run = useSessionUseCases();
  const [loaded, setLoaded] = useState<{ readonly summary: SessionSummary | null } | null>(null);

  useEffect(() => {
    let cancelled = false;
    void run((session, deps) => session.workoutSummary(deps, sessionId)).then((summary) => {
      if (!cancelled) setLoaded({ summary });
    });
    return () => {
      cancelled = true;
    };
  }, [run, sessionId]);

  return (
    <Screen title={t`Workout summary`}>
      {loaded === null ? (
        <output className="block text-fg-muted">
          <Trans>Preparing the summary…</Trans>
        </output>
      ) : loaded.summary === null ? (
        <Card>
          <p>
            <Trans>This workout was not found. It may have been deleted.</Trans>
          </p>
          <Link to="/" className={buttonClass({ size: 'lg' })}>
            <Trans>Back to Home</Trans>
          </Link>
        </Card>
      ) : (
        <SummaryContent summary={loaded.summary} />
      )}
    </Screen>
  );
}

function SummaryContent({ summary }: { summary: SessionSummary }) {
  const { t } = useLingui();
  const labels = useLabels();
  const unit = useLoadUnit();
  const words = useSummaryWords();
  const minutes = Math.round(summary.durationMs / 60_000);
  const duration = formatMinutes(minutes);
  const started = formatTime(summary.startedAt.epochMs);
  const ended = summary.endedAt ? formatTime(summary.endedAt.epochMs) : null;
  const { plannedWorking, doneWorking, done, skipped } = summary.sets;
  const volume = summary.volume
    .filter((row) => row.fractional > 0)
    .toSorted((a, b) => b.fractional - a.fractional);
  const firstTimes = new Intl.ListFormat(undefined, { type: 'conjunction' }).format(
    summary.firstTimes.map((id) => labels.exercise(id)),
  );

  return (
    <>
      <Card>
        <h2 className="text-lg font-semibold">
          <Trans>At a glance</Trans>
        </h2>
        <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2">
          <dt className="text-fg-muted">
            <Trans>Duration</Trans>
          </dt>
          <dd className="font-semibold tabular">
            {ended ? (
              <Trans>
                {duration} ({started}–{ended})
              </Trans>
            ) : (
              duration
            )}
          </dd>
          <dt className="text-fg-muted">
            <Trans>Sets</Trans>
          </dt>
          <dd className="font-semibold tabular">
            {plannedWorking > 0 ? (
              <Trans>
                {doneWorking} of {plannedWorking} planned sets
              </Trans>
            ) : (
              <Plural value={done} one="# set logged" other="# sets logged" />
            )}
          </dd>
          {skipped > 0 ? (
            <>
              <dt className="text-fg-muted">
                <Trans>Skipped</Trans>
              </dt>
              <dd className="font-semibold tabular">
                <Plural value={skipped} one="# set" other="# sets" />
              </dd>
            </>
          ) : null}
        </dl>
        <div className="flex flex-wrap gap-2">
          {summary.status === 'partial' ? (
            <Badge tone="neutral">{t`Finished as partial`}</Badge>
          ) : null}
          {summary.countsForStreak ? (
            <Badge tone="ok">{t`Counts for your weekly streak`}</Badge>
          ) : (
            <Badge tone="neutral" icon={null}>
              {t`Does not count for the streak: less than half of the planned sets done`}
            </Badge>
          )}
        </div>
      </Card>

      <DeloadCheck sessionId={summary.sessionId} />

      {summary.prs.length > 0 ? <PrCard summary={summary} /> : null}

      {summary.countsForStreak ? <StreakChangeCard sessionId={summary.sessionId} /> : null}

      <WeekHeatCard day={sessionDay(summary)} />

      {summary.firstTimes.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">
            <Trans>First time</Trans>
          </h2>
          <p>
            <Trans>
              New exercises today: {firstTimes}. POWR starts tracking them from these sets.
            </Trans>
          </p>
        </Card>
      ) : null}

      {summary.e1rm.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">
            <Trans>Estimated 1-rep max</Trans>
          </h2>
          <ul className="flex flex-col gap-3">
            {summary.e1rm.map((row) => {
              const name = labels.exercise(row.exerciseId);
              const before = row.beforeKg === null ? null : massFromKg(row.beforeKg, unit, 1);
              const after = row.afterKg === null ? null : massFromKg(row.afterKg, unit, 1);
              return (
                <li key={row.exerciseId} className="flex flex-col gap-0.5">
                  <span className="font-semibold">{name}</span>
                  <span className="tabular">
                    {before && after ? (
                      <Trans>
                        {before} → {after}
                      </Trans>
                    ) : after ? (
                      <Trans>First estimate: {after}</Trans>
                    ) : (
                      <Trans>No estimate from these sets</Trans>
                    )}
                  </span>
                  {row.change ? (
                    <span className="flex flex-wrap items-center gap-1 text-sm text-fg-muted">
                      {words.trend(row.change.value)}
                      <WhyButton why={row.change.why} subject={t`the change of ${name}`} />
                    </span>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {volume.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">
            <Trans>Sets per muscle</Trans>
          </h2>
          <p className="text-sm text-fg-muted">
            <Trans>
              Counted as fractional sets: a set counts fully for the muscles it trains directly and
              partly for the others.
            </Trans>
          </p>
          <ul className="flex flex-col gap-1">
            {volume.map((row) => {
              const sets = Math.round(row.fractional * 10) / 10;
              return (
                <li
                  key={row.muscle}
                  className="flex flex-wrap justify-between gap-x-3 border-b border-border py-1 last:border-0"
                >
                  <span>{labels.muscle(row.muscle)}</span>
                  <span className="font-semibold tabular">
                    <Plural value={sets} one="# set" other="# sets" />
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      ) : null}

      {summary.changes.length > 0 ? (
        <Card>
          <h2 className="text-lg font-semibold">
            <Trans>Changes you accepted</Trans>
          </h2>
          <ul className="list-disc pl-5">
            {summary.changes.map((change) => (
              <li key={`${change.kind}:${change.slotKeys.join(',')}`}>{words.change(change)}</li>
            ))}
          </ul>
        </Card>
      ) : null}

      {summary.note ? (
        <Card>
          <h2 className="text-lg font-semibold">
            <Trans>Note</Trans>
          </h2>
          <p className="whitespace-pre-line">{summary.note}</p>
        </Card>
      ) : null}

      {/* DAT-08 and PWA-02 (M5d): after a finished workout, when due and never mid-workout. */}
      <BackupReminder />
      <InstallPromotion />

      <div className="flex flex-col gap-2">
        <Link to="/" className={buttonClass({ variant: 'primary', size: 'lg' })}>
          <Trans>Done</Trans>
        </Link>
        <Link
          to="/session/past/$sessionId"
          params={{ sessionId: summary.sessionId }}
          className={buttonClass({ size: 'lg' })}
        >
          <Trans>Edit this workout</Trans>
        </Link>
      </div>
    </>
  );
}

/**
 * MOT-02: the PRs of the session, one line each, with the same short scale-in as the in-session
 * card (`pr-pop`, ≤ 600 ms, once). Under reduced motion the base styles zero every animation
 * duration, so the card is static (NFR-A11Y-08).
 */
function PrCard({ summary }: { summary: SessionSummary }) {
  const words = useSessionWords();
  const unit = useLoadUnit();
  // SET-10 (M5s): celebration animations can be switched off; the card still shows.
  const { celebrations } = useDisplayPreferences();
  return (
    <section
      aria-labelledby="summary-prs"
      data-testid="summary-prs"
      className={cn(
        'flex flex-col gap-3 rounded-2xl border-2 border-control bg-surface p-4',
        celebrations && 'animate-[pr-pop_600ms_ease-out]',
      )}
    >
      <h2 id="summary-prs" className="flex items-center gap-2 text-lg font-semibold">
        <Trophy aria-hidden="true" className="size-6 text-pr-accent" />
        <Trans>New personal records</Trans>
      </h2>
      <p className="text-fg-muted">
        <Plural
          value={summary.prs.length}
          one="# record in this workout. Well earned."
          other="# records in this workout. Well earned."
        />
      </p>
      <ul className="flex flex-col gap-2">
        {summary.prs.map((pr) => (
          <li key={pr.id} className="flex items-start gap-2">
            <Trophy aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pr-accent" />
            <span>{words.pr(pr, unit)}</span>
          </li>
        ))}
      </ul>
      <Link to="/progress/prs" className={buttonClass({ size: 'lg' })}>
        <Trans>All personal records</Trans>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </section>
  );
}

/**
 * MOT-02/03 (WKT-13 "adherence impact on the weekly streak"): what this workout did to the
 * streak, independent of whether the post-finish rebuild has run (`sessionStreakChange`); a new
 * best streak gets the PR card's short scale-in, static under reduced motion.
 */
function StreakChangeCard({ sessionId }: { sessionId: SessionId }) {
  const streakWords = useStreakWords();
  const change = useInsight(`streak-change:${sessionId}`, (insights, deps) =>
    insights.sessionStreakChange(deps, sessionId),
  );
  const { celebrations } = useDisplayPreferences();
  if (!change.loaded || change.value === null) return null;
  const { current, newBest } = change.value;
  const weeks = streakWords.weeks(current);
  return (
    <section
      aria-labelledby="summary-streak"
      data-testid="summary-streak"
      className={
        newBest
          ? cn(
              'flex flex-col gap-2 rounded-2xl border-2 border-control bg-surface p-4',
              celebrations && 'animate-[pr-pop_600ms_ease-out]',
            )
          : 'flex flex-col gap-2 rounded-2xl bg-surface p-4'
      }
    >
      <h2 id="summary-streak" className="flex items-center gap-2 text-lg font-semibold">
        <Flame aria-hidden="true" className="size-6 text-pr-accent" />
        {newBest ? (
          <Trans>New best streak: {weeks}</Trans>
        ) : (
          <Trans>Week kept: {weeks} in a row</Trans>
        )}
      </h2>
      <p>
        {newBest ? (
          <Trans>This workout kept your week and set your longest streak yet.</Trans>
        ) : (
          <Trans>This workout kept your week. Your streak grew to {weeks}.</Trans>
        )}
      </p>
      <Link to="/progress/streak" className={buttonClass({ size: 'lg' })}>
        <Trans>Your streak</Trans>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </section>
  );
}

/**
 * WKT-13 "volume by muscle (mini heat map)": the week of this workout with it included, from the
 * same derived weeks as the body map (one calculation, ANL-03); the list below has this
 * workout's own sets per muscle.
 */
function WeekHeatCard({ day }: { day: string }) {
  const { t } = useLingui();
  const sentence = useHeatSentence();
  const week = useInsight(`summary-week:${day}`, (insights, deps) =>
    insights.weeklyVolume(deps, { mode: 'week', date: day as LocalDate }),
  );
  if (!week.loaded) return null;
  const rows = week.value.rows;
  const current =
    week.value.weekStart <= todayLocal() && todayLocal() < nextWeek(week.value.weekStart);
  const from = formatLocalDate(week.value.weekStart, 'long');
  return (
    <Card>
      <h2 className="text-lg font-semibold">
        {current ? <Trans>Your week so far</Trans> : <Trans>The week of {from}</Trans>}
      </h2>
      <Suspense fallback={null}>
        <MiniHeatMap rows={rows} legendTitle={t`Heat map key`} />
      </Suspense>
      <p data-testid="summary-heat-summary">{sentence(rows)}</p>
      <Link to="/explore/body-map" className={buttonClass({ size: 'lg' })}>
        <Trans>Open the body map</Trans>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </Card>
  );
}

function nextWeek(weekStart: string): string {
  return addLocalDays(weekStart, 7);
}

/** PRG-12: after a finish, the reactive-deload proposal with its reasons, if any. */
function DeloadCheck({ sessionId }: { sessionId: SessionId }) {
  const { t } = useLingui();
  const deload = useSessionUi((state) =>
    state.deloadCheck?.sessionId === sessionId ? state.deloadCheck : null,
  );
  const planning = usePlanning();
  const [state, setState] = useState<'idle' | 'busy' | 'done' | 'failed'>('idle');
  if (!deload?.check.propose || deload.check.week === null) return null;
  const week = deload.check.week;
  const bringForward = async () => {
    setState('busy');
    const result = await planning((entry, deps) =>
      entry.bringDeloadForward(deps, { planId: deload.planId, week }),
    );
    setState(result.ok ? 'done' : 'failed');
    if (result.ok) announce(t`Your lighter week now starts next week.`);
  };
  return (
    <Callout tone="warning" title={t`Consider bringing your lighter week forward`}>
      <p>
        <Trans>
          Your recent sessions show signs of fatigue. A lighter week now can help you recover and
          keep progressing.
        </Trans>
      </p>
      <WhyButton why={deload.check.why} subject={t`the lighter week`} />
      {state === 'done' ? (
        <p className="flex items-center gap-2 font-semibold">
          <CalendarClock aria-hidden="true" className="size-5" />
          <Trans>Done: your lighter week starts next week.</Trans>
        </p>
      ) : (
        <Button variant="primary" disabled={state === 'busy'} onClick={() => void bringForward()}>
          <Trans>Bring the lighter week forward</Trans>
        </Button>
      )}
      {state === 'failed' ? (
        <p className="text-danger">
          <Trans>That did not work. Try again from the plan.</Trans>
        </p>
      ) : null}
    </Callout>
  );
}
