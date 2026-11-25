import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import {
  CalendarDays,
  ChevronRight,
  CircleCheck,
  CloudOff,
  Flame,
  Scale,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { lazy, Suspense } from 'react';

import type { Deps } from '@powr/application';
import type { HomeView } from '@powr/application/insights';
import type { LocalDate, Session } from '@powr/domain';

import { Badge } from '#ui/badge';
import { buttonClass } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { useOfflineReady } from '../../hooks/use-app';
import { useLiveInsight, type Insights } from '../../hooks/use-insights';
import { useActivePlan, usePlannedSessions } from '../../hooks/use-planning';
import { useActiveSession, useSessionSets } from '../../hooks/use-session';
import { addLocalDays, formatLocalDate, formatMinutes, todayLocal } from '../../i18n/format';
import { useBodyWords, useBodyweightUnit } from '../body/words';
import { BackupReminder } from '../data/BackupReminder';
import { useHeatSentence, useStreakWords } from '../insights/words';
import { useLabels } from '../labels';
import { useSummaryWords } from '../session/past/parts';
import { massFromKg, useLoadUnit, useSessionWords } from '../session/words';
import { InstallPromotion } from '../shell/InstallPromotion';
import { WhyButton } from '../why/WhySheet';
import { Sparkline } from './Sparkline';

/** The body-map artwork stays off the startup path: the mini heat map is its own chunk. */
const MiniHeatMap = lazy(() => import('../insights/MiniHeatMap'));

const linkButtonClass =
  'flex min-h-target-lg w-full items-center justify-center rounded-xl px-4 text-lg font-semibold';

const openHome = (insights: Insights, deps: Deps) => insights.observeHome(deps);

/** "+4.1%", "−2%". */
function formatSignedPercent(value: number): string {
  const shown = new Intl.NumberFormat(undefined, {
    maximumFractionDigits: 1,
    signDisplay: 'exceptZero',
  }).format(Math.round(value * 10) / 10);
  return `${shown}%`;
}

/**
 * ANL-01 Home: today's session (or "Rest day" with the next one) as a one-tap start, this
 * week's progress and streak (MOT-03) with the mini heat map (MAP-04), the last workout, recent
 * PRs and "likely real" changes, the bodyweight trend, the meet countdown and points for
 * powerlifters, and a backup indicator. The planned-session card comes from the startup data;
 * everything else from one live insight query (`observeHome`), which says when it is still
 * catching up (`refreshing`).
 */
export function HomeScreen() {
  const { t } = useLingui();
  const session = useActiveSession();
  const offlineReady = useOfflineReady();
  const home = useLiveInsight('home', openHome);
  const view = home.loaded ? home.value : null;

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
        <TodayCard />
      )}

      {/* PWA-02: never on the first visit or during a workout (the card checks both). */}
      <InstallPromotion />

      <output data-testid="home-status" className="block text-sm text-fg-muted empty:hidden">
        {view === null ? (
          <Trans>Loading your week…</Trans>
        ) : view.refreshing ? (
          <Trans>Updating your weekly numbers…</Trans>
        ) : null}
      </output>

      {view ? (
        <>
          <WeekCard view={view} />
          {view.lastSession ? <LastSessionCard last={view.lastSession} /> : null}
          <RecentProgressCard view={view} />
          <BodyweightCard view={view} />
          {view.meet || view.scores?.totalKg ? <MeetCard view={view} /> : null}
          <BackupCard view={view} />
        </>
      ) : null}
    </Screen>
  );
}

function ActiveSessionCard({ session }: { session: Session }) {
  const sets = useSessionSets(session.id);
  const count = sets.loaded ? sets.value.length : 0;
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Workout in progress</Trans>
      </h2>
      <p className="text-fg-muted">
        <Plural value={count} one="# set logged" other="# sets logged" />
      </p>
      <Link to="/session" className={`${linkButtonClass} bg-primary text-on-primary`}>
        <Trans>Continue workout</Trans>
      </Link>
    </Card>
  );
}

/**
 * Today's planned session as a one-tap start (WKT-01), or "Rest day" with the next session
 * (ANL-01); without a plan, a freestyle start and the way to a plan (M2b, PLN-15).
 */
function TodayCard() {
  const plan = useActivePlan();
  const today = todayLocal();
  const sessions = usePlannedSessions(today as LocalDate, addLocalDays(today, 21) as LocalDate);
  if (!plan.loaded) return null;
  if (!plan.value) {
    return (
      <>
        <Card>
          <h2 className="text-lg font-bold">
            <Trans>Today</Trans>
          </h2>
          <p>
            <Trans>Log your training as you go. Everything stays on this phone.</Trans>
          </p>
          <Link to="/session" className={`${linkButtonClass} bg-primary text-on-primary`}>
            <Trans>Start a workout</Trans>
          </Link>
        </Card>
        <Card>
          <h2 className="text-lg font-bold">
            <Trans>Plan not set up</Trans>
          </h2>
          <p className="text-fg-muted">
            <Trans>
              Get a plan for your days, time and equipment, with every choice explained.
            </Trans>
          </p>
          <Link
            to="/plan/setup/$step"
            params={{ step: 'goal' }}
            className={`${linkButtonClass} border border-control`}
          >
            <Trans>Set up a plan</Trans>
          </Link>
        </Card>
      </>
    );
  }
  const next = sessions.loaded
    ? sessions.value.find((session) => session.status === 'planned')
    : undefined;
  const isToday = next?.localDate === today;
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <CalendarDays aria-hidden="true" />
        {isToday || !next ? <Trans>Today</Trans> : <Trans>Rest day</Trans>}
      </h2>
      {next ? (
        <>
          <p data-testid="next-session">
            {isToday ? (
              <>
                <span className="font-semibold">{next.name.en}</span>
                {' · '}
                <Trans>today</Trans>
              </>
            ) : (
              <Trans>
                Next: <span className="font-semibold">{next.name.en}</span> ·{' '}
                {formatLocalDate(next.localDate, 'long')}
              </Trans>
            )}
          </p>
          {next.kind === 'deload' ? (
            <Badge tone="info" icon={null} className="self-start">
              <Trans>Lighter week: part of the plan</Trans>
            </Badge>
          ) : null}
          {!isToday ? (
            <p className="text-sm text-fg-muted">
              <Trans>Rest is part of training: your muscles grow between sessions.</Trans>
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-fg-muted">
          <Trans>Nothing planned in the next three weeks.</Trans>
        </p>
      )}
      {isToday ? (
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

/** MOT-03 this week's progress and the streak, with the mini heat map of the week (MAP-04). */
function WeekCard({ view }: { view: HomeView }) {
  const { t } = useLingui();
  const streakWords = useStreakWords();
  const heatSentence = useHeatSentence();
  const progress = view.week.progress;
  const trained = view.week.volume.some((row) => row.fractional > 0);
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>This week</Trans>
      </h2>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
        <dt className="text-fg-muted">
          <Trans>Sessions</Trans>
        </dt>
        <dd className="font-semibold tabular" data-testid="week-progress">
          {progress ? (
            <>
              {streakWords.progress(progress.done, progress.target)}
              {' · '}
              {streakWords.weekState(progress.state)}
            </>
          ) : (
            <Trans>No sessions yet</Trans>
          )}
        </dd>
        {view.week.minutes > 0 ? (
          <>
            <dt className="text-fg-muted">
              <Trans>Time trained</Trans>
            </dt>
            <dd className="font-semibold tabular">
              {formatMinutes(Math.round(view.week.minutes))}
            </dd>
          </>
        ) : null}
        <dt className="text-fg-muted">
          <Trans>Streak</Trans>
        </dt>
        <dd className="flex items-center gap-1 font-semibold tabular" data-testid="home-streak">
          <Flame aria-hidden="true" className="size-4 text-pr-accent" />
          {view.streak ? (
            <Trans>
              {streakWords.weeks(view.streak.current)}, best {streakWords.weeks(view.streak.best)}
            </Trans>
          ) : (
            <Trans>Starts with your first kept week</Trans>
          )}
        </dd>
      </dl>
      <Link to="/progress/streak" className={buttonClass({ size: 'lg' })}>
        <Trans>Your streak</Trans>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>

      <h3 className="pt-2 font-semibold">
        <Trans>Hard sets per muscle</Trans>
      </h3>
      {trained ? (
        <>
          <Suspense fallback={null}>
            <MiniHeatMap rows={view.week.volume} legendTitle={t`Heat map key`} />
          </Suspense>
          <p data-testid="home-heat-summary">{heatSentence(view.week.volume)}</p>
        </>
      ) : (
        <p className="text-fg-muted">
          <Trans>No hard sets yet this week. Your first workout fills in the map.</Trans>
        </p>
      )}
      <Link to="/explore/body-map" className={buttonClass({ size: 'lg' })}>
        <Trans>Open the body map</Trans>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </Card>
  );
}

function LastSessionCard({ last }: { last: NonNullable<HomeView['lastSession']> }) {
  const labels = useLabels();
  const names = last.exerciseIds.slice(0, 3).map((id) => labels.exercise(id));
  const more = last.exerciseIds.length - names.length;
  const shown = names.join(', ');
  const date = formatLocalDate(last.localDate, 'long');
  const minutes = last.durationMs === null ? null : Math.round(last.durationMs / 60_000);
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Last workout</Trans>
      </h2>
      <p className="font-semibold">{date}</p>
      <p className="text-fg-muted">
        {more > 0 ? (
          <Plural value={more} one={`${shown} and # more`} other={`${shown} and # more`} />
        ) : (
          shown
        )}
      </p>
      <p className="tabular">
        <Plural value={last.doneSets} one="# set" other="# sets" />
        {minutes !== null ? (
          <>
            {' · '}
            {formatMinutes(minutes)}
          </>
        ) : null}
        {last.prs.length > 0 ? (
          <>
            {' · '}
            <Plural value={last.prs.length} one="# PR" other="# PRs" />
          </>
        ) : null}
      </p>
      <Link
        to="/session/summary/$sessionId"
        params={{ sessionId: last.sessionId }}
        className={buttonClass({ size: 'lg' })}
      >
        <Trans>Open the summary</Trans>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </Card>
  );
}

/** ANL-01 recent PRs (MOT-01) and "likely real" e1RM changes (PRG-02). */
function RecentProgressCard({ view }: { view: HomeView }) {
  const labels = useLabels();
  const unit = useLoadUnit();
  const words = useSessionWords();
  const summaryWords = useSummaryWords();
  const prs = view.recentPrs.slice(0, 3);
  const changes = view.trendChanges.slice(0, 3);
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Recent progress</Trans>
      </h2>
      {prs.length === 0 && changes.length === 0 ? (
        <p className="text-fg-muted">
          <Trans>
            Personal records and real strength changes show here. Every logged set counts toward
            them.
          </Trans>
        </p>
      ) : null}
      {prs.length > 0 ? (
        <ul className="flex flex-col gap-2" data-testid="home-prs">
          {prs.map((pr) => (
            <li key={pr.id} className="flex items-start gap-2">
              <Trophy aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-pr-accent" />
              <span>
                {words.pr(pr, unit)}
                <span className="block text-sm text-fg-muted">
                  {formatLocalDate(pr.localDate, 'long')}
                </span>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
      {changes.length > 0 ? (
        <ul className="flex flex-col gap-2" data-testid="home-changes">
          {changes.map((change) => {
            const name = labels.exercise(change.exerciseId);
            return (
              <li key={`${change.exerciseId}:${change.sessionId}`}>
                <Link
                  to="/progress/exercise/$exerciseId"
                  params={{ exerciseId: change.exerciseId }}
                  className="flex min-h-target items-start gap-2 rounded-xl py-1 underline-offset-4 hover:underline"
                >
                  <TrendingUp aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-info" />
                  <span>
                    <span className="font-semibold">{name}</span>
                    {': '}
                    {summaryWords.trend({ ...change.change, deltaLog: 0, typicalError: 0 })}
                    {' · '}
                    <span className="tabular">{formatSignedPercent(change.change.deltaPct)}</span>
                    {change.change.repRange ? (
                      <span className="block text-sm text-fg-muted">
                        <Trans>Your rep range changed too, so part of it may be the formula.</Trans>
                      </span>
                    ) : null}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
      <Link to="/progress/prs" className={buttonClass({ size: 'lg' })}>
        <Trans>All personal records</Trans>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </Card>
  );
}

/** ANL-01 bodyweight trend sparkline (BOD-02) and the one-tap way to log (BOD-01). */
function BodyweightCard({ view }: { view: HomeView }) {
  const { t } = useLingui();
  const unit = useBodyweightUnit();
  const words = useBodyWords();
  const bodyweight = view.bodyweight;
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <Scale aria-hidden="true" />
        <Trans>Bodyweight</Trans>
      </h2>
      {bodyweight ? (
        <>
          <p data-testid="home-bodyweight">
            {bodyweight.trendKg !== null ? (
              <Trans>
                Trend <span className="font-semibold">{words.mass(bodyweight.trendKg, unit)}</span>
              </Trans>
            ) : (
              <Trans>
                Last weigh-in{' '}
                <span className="font-semibold">{words.mass(bodyweight.latestKg, unit)}</span>
              </Trans>
            )}
            {bodyweight.rate.value ? (
              <span className="block text-fg-muted">{words.rate(bodyweight.rate.value, unit)}</span>
            ) : null}
          </p>
          <Sparkline
            values={bodyweight.sparkline.map((point) => point.trendKg)}
            className="h-10 w-full text-info"
          />
          <p className="flex flex-wrap items-center gap-x-2 text-sm">
            {words.band(bodyweight.band.value)}
            <WhyButton why={bodyweight.band.why} subject={t`your bodyweight rate`} />
          </p>
        </>
      ) : (
        <p className="text-fg-muted">
          <Trans>Log your bodyweight to see its trend. Mornings work best.</Trans>
        </p>
      )}
      <Link to="/body/log" className={buttonClass({ variant: 'primary', size: 'lg' })}>
        <Trans>Log bodyweight</Trans>
      </Link>
      <Link to="/body" className={buttonClass({ size: 'lg' })}>
        <Trans>Trend and measurements</Trans>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </Card>
  );
}

/** ANL-01 for powerlifters: the meet countdown and the current total with its points (ANL-07). */
function MeetCard({ view }: { view: HomeView }) {
  const unit = useLoadUnit();
  const total = view.scores?.totalKg ?? null;
  const gl = view.scores?.formulas.find((formula) => formula.formula === 'ipfGl')?.total ?? null;
  return (
    <Card>
      <h2 className="text-lg font-bold">
        <Trans>Powerlifting</Trans>
      </h2>
      {view.meet ? (
        <p data-testid="home-meet">
          <Plural
            value={view.meet.daysUntil}
            _0="Meet day is today"
            one="Meet in # day"
            other="Meet in # days"
          />
          {' · '}
          {formatLocalDate(view.meet.date, 'long')}
        </p>
      ) : null}
      {total !== null ? (
        <p>
          <Trans>
            Current total{' '}
            <span className="font-semibold tabular">{massFromKg(total, unit, 1)}</span>
          </Trans>
          {gl !== null ? (
            <span className="block text-fg-muted">
              <Trans>
                IPF GL points{' '}
                {new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }).format(gl)}
              </Trans>
            </span>
          ) : null}
        </p>
      ) : null}
      <Link to="/progress/scores" className={buttonClass({ size: 'lg' })}>
        <Trans>Scores and points</Trans>
        <ChevronRight aria-hidden="true" className="size-5" />
      </Link>
    </Card>
  );
}

/**
 * ANL-01 backup indicator (DAT-08): without training data the restore offer for a new phone;
 * with it, the M5d backup reminder (cadence, workouts since, "Remind me later"; TD-57).
 */
function BackupCard({ view }: { view: HomeView }) {
  if (view.lastSession === null) {
    return (
      <Card>
        <p className="text-fg-muted">
          <Trans>New phone? Restore your training data from a backup file.</Trans>
        </p>
        <Link to="/data" className={`${linkButtonClass} border border-control`}>
          <Trans>Restore from a backup</Trans>
        </Link>
      </Card>
    );
  }
  return <BackupReminder />;
}
