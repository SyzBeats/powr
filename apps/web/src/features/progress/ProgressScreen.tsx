import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import {
  CalendarDays,
  ChartColumn,
  ChartLine,
  ChevronRight,
  Flame,
  GitCompare,
  History,
  Hourglass,
  Medal,
  Minus,
  Scale,
  TrendingDown,
  TrendingUp,
  Trophy,
} from 'lucide-react';
import { useEffect, useState } from 'react';

import type { ExerciseSummary } from '@powr/application/insights';
import type { LocalDate } from '@powr/domain';
import type { ChangeLabel } from '@powr/domain/trend';

import { Button } from '#ui/button';
import { preloadCharts } from '#ui/charts/echart';
import { Card, Screen } from '#ui/screen';

import { useInsight } from '../../hooks/use-insights';
import { addLocalDays, formatLocalDate, todayLocal } from '../../i18n/format';
import { useLabels } from '../labels';
import { useSummaryWords } from '../session/past/parts';
import { massFromKg, useLoadUnit } from '../session/words';
import { Loading, RowContent, rowClass } from './parts';

/** How many trained exercises the hub lists before "Show all". */
const SHOWN = 8;

/**
 * The Progress tab (M4b, §8.9.1): the user's trained exercises, each opening its strength trend
 * and history (ANL-02, ANL-04), and the analytics screens: compare lifts, volume per muscle
 * (ANL-03), PRs (ANL-05), calendar and history (ANL-06), scores (ANL-07), the weekly streak
 * (MOT-03/04), bodyweight (BOD-01…03) and the past sessions (WKT-15).
 */
export function ProgressScreen() {
  const { t } = useLingui();
  return (
    <Screen title={t`Progress`}>
      <nav aria-label={t`Progress sections`}>
        <ul className="flex flex-col gap-2">
          <li>
            <Link to="/progress/volume" className={rowClass}>
              <RowContent
                icon={ChartColumn}
                title={t`Volume per muscle`}
                hint={t`Weekly hard sets against your targets`}
              />
            </Link>
          </li>
          <li>
            <Link to="/progress/prs" className={rowClass}>
              <RowContent
                icon={Trophy}
                title={t`Personal records`}
                hint={t`Every PR by type and exercise`}
              />
            </Link>
          </li>
          <li>
            <Link to="/progress/calendar" className={rowClass}>
              <RowContent
                icon={CalendarDays}
                title={t`Calendar and history`}
                hint={t`Month view and a searchable list of workouts`}
              />
            </Link>
          </li>
          <li>
            <Link to="/progress/compare" className={rowClass}>
              <RowContent
                icon={GitCompare}
                title={t`Compare lifts`}
                hint={t`Up to three strength trends on one chart`}
              />
            </Link>
          </li>
          <li>
            <Link to="/progress/streak" className={rowClass}>
              <RowContent
                icon={Flame}
                title={t`Weekly streak`}
                hint={t`Kept weeks, breaks and how the streak counts`}
              />
            </Link>
          </li>
          <li>
            <Link to="/body" className={rowClass}>
              <RowContent
                icon={Scale}
                title={t`Bodyweight and measurements`}
                hint={t`Trend, weekly rate and measurements`}
              />
            </Link>
          </li>
          <li>
            <Link to="/progress/scores" className={rowClass}>
              <RowContent
                icon={Medal}
                title={t`Powerlifting scores`}
                hint={t`IPF GL, DOTS and more for your total`}
              />
            </Link>
          </li>
          <li>
            <Link to="/session/past" className={rowClass}>
              <RowContent
                icon={History}
                title={t`Past workouts`}
                hint={t`Edit a workout or log one for a past date`}
              />
            </Link>
          </li>
        </ul>
      </nav>
      <TrainedExercises />
    </Screen>
  );
}

/** TD-55: the trained exercises with their current estimate and the trend's latest label. */
function TrainedExercises() {
  const [showAll, setShowAll] = useState(false);
  // M6a: every row opens a chart; its chunk loads in idle time, not on the tap.
  useEffect(() => {
    if (!('requestIdleCallback' in window)) return undefined;
    const handle = window.requestIdleCallback(preloadCharts, { timeout: 3000 });
    return () => window.cancelIdleCallback(handle);
  }, []);
  const from = addLocalDays(todayLocal(), -365) as LocalDate;
  const summaries = useInsight(`trained:${from}`, (insights, deps) =>
    insights.exerciseSummaries(deps, { from }),
  );
  const list = summaries.loaded ? summaries.value : [];
  const shown = showAll ? list : list.slice(0, SHOWN);
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <ChartLine aria-hidden="true" className="size-5" />
        <Trans>Strength trends</Trans>
      </h2>
      {!summaries.loaded ? (
        <Loading />
      ) : list.length === 0 ? (
        <p className="text-fg-muted">
          <Trans>
            Finish a workout and each exercise gets its estimated 1-rep max trend and history here.
          </Trans>
        </p>
      ) : (
        <>
          <p className="text-fg-muted">
            <Trans>
              Your exercises of the last 12 months, most trained first, with the current estimated
              1-rep max and whether it changed for real.
            </Trans>
          </p>
          <ul className="flex flex-col gap-2" data-testid="trained-exercises">
            {shown.map((entry) => (
              <li key={entry.exerciseId}>
                <TrainedRow entry={entry} />
              </li>
            ))}
          </ul>
          {list.length > SHOWN ? (
            <Button onClick={() => setShowAll((current) => !current)}>
              {showAll ? (
                <Trans>Show fewer</Trans>
              ) : (
                <Trans>Show all {list.length} exercises</Trans>
              )}
            </Button>
          ) : null}
        </>
      )}
    </Card>
  );
}

/** The label of an estimate without a strength trend (only all-sets estimates so far). */
const NO_STRENGTH_TREND: ChangeLabel = {
  label: 'insufficientData',
  direction: null,
  deltaLog: 0,
  deltaPct: 0,
  referenceDate: null,
  typicalError: 0,
};

/**
 * One trained exercise: its name, how often and when, the current estimate (as ANL-04 states it)
 * and the latest change label in words with an icon (PRG-02; never colour alone), the same label
 * the trend screen gives as "Latest change".
 */
function TrainedRow({ entry }: { entry: ExerciseSummary }) {
  const { t } = useLingui();
  const labels = useLabels();
  const unit = useLoadUnit();
  const words = useSummaryWords();
  const date = formatLocalDate(entry.lastDate, 'short');
  const count = plural(entry.sessions, { one: '# workout', other: '# workouts' });
  const change = entry.change?.value ?? NO_STRENGTH_TREND;
  const ChangeIcon =
    change.label === 'insufficientData'
      ? Hourglass
      : change.label === 'none'
        ? Minus
        : change.direction === 'down'
          ? TrendingDown
          : TrendingUp;
  const e1rm = entry.e1rm ? massFromKg(entry.e1rm.kg, unit, 1) : null;
  return (
    <Link
      to="/progress/exercise/$exerciseId"
      params={{ exerciseId: entry.exerciseId }}
      className={`${rowClass} border border-control`}
    >
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-semibold">{labels.exercise(entry.exerciseId)}</span>
        <span className="text-sm text-fg-muted">{t`${count}, last on ${date}`}</span>
        {e1rm === null ? (
          <span className="text-sm text-fg-muted">
            <Trans>No estimated 1-rep max yet: it needs sets with an effort rating</Trans>
          </span>
        ) : (
          <>
            <span className="tabular" data-testid="trained-e1rm">
              {entry.calibration === 'calibrated' ? (
                <Trans>Estimated 1-rep max {e1rm}</Trans>
              ) : (
                <Trans>Estimated 1-rep max {e1rm}, still calibrating</Trans>
              )}
            </span>
            <span className="flex items-start gap-1.5 text-sm" data-testid="trained-change">
              <ChangeIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-info" />
              <span>{words.trend(change)}</span>
            </span>
          </>
        )}
      </span>
      <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-fg-muted" />
    </Link>
  );
}
