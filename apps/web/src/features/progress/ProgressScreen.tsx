import { plural } from '@lingui/core/macro';
import { Trans, useLingui } from '@lingui/react/macro';
import { Link } from '@tanstack/react-router';
import {
  CalendarDays,
  ChartColumn,
  ChartLine,
  Flame,
  GitCompare,
  History,
  Medal,
  Scale,
  Trophy,
} from 'lucide-react';
import { useState } from 'react';

import type { ExerciseId, LocalDate } from '@powr/domain';
import type { SessionListItem } from '@powr/domain/analytics';

import { Button } from '#ui/button';
import { Card, Screen } from '#ui/screen';

import { useInsight } from '../../hooks/use-insights';
import { addLocalDays, formatLocalDate, todayLocal } from '../../i18n/format';
import { useLabels } from '../labels';
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
                title={t`Past sessions`}
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

interface Trained {
  readonly exerciseId: ExerciseId;
  readonly sessions: number;
  readonly lastDate: LocalDate;
}

/** The exercises of the last year's workouts, most trained first. */
function trainedExercises(items: readonly SessionListItem[]): Trained[] {
  const byId = new Map<ExerciseId, { sessions: number; lastDate: LocalDate }>();
  for (const item of items) {
    for (const exerciseId of item.exerciseIds) {
      const entry = byId.get(exerciseId) ?? { sessions: 0, lastDate: item.session.localDate };
      entry.sessions += 1;
      if (item.session.localDate > entry.lastDate) entry.lastDate = item.session.localDate;
      byId.set(exerciseId, entry);
    }
  }
  return [...byId]
    .map(([exerciseId, entry]) => ({ exerciseId, ...entry }))
    .toSorted(
      (a, b) =>
        b.sessions - a.sessions || (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0),
    );
}

function TrainedExercises() {
  const { t } = useLingui();
  const labels = useLabels();
  const [showAll, setShowAll] = useState(false);
  const from = addLocalDays(todayLocal(), -365) as LocalDate;
  const history = useInsight(`trained:${from}`, (insights, deps) =>
    insights.sessionHistory(deps, { from }),
  );
  const list = history.loaded ? trainedExercises(history.value) : [];
  const shown = showAll ? list : list.slice(0, SHOWN);
  return (
    <Card>
      <h2 className="flex items-center gap-2 text-lg font-bold">
        <ChartLine aria-hidden="true" className="size-5" />
        <Trans>Strength trends</Trans>
      </h2>
      {!history.loaded ? (
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
            <Trans>Your exercises of the last 12 months, most trained first.</Trans>
          </p>
          <ul className="flex flex-col gap-2" data-testid="trained-exercises">
            {shown.map((entry) => {
              const date = formatLocalDate(entry.lastDate, 'short');
              const count = plural(entry.sessions, { one: '# workout', other: '# workouts' });
              return (
                <li key={entry.exerciseId}>
                  <Link
                    to="/progress/exercise/$exerciseId"
                    params={{ exerciseId: entry.exerciseId }}
                    className={`${rowClass} border border-control`}
                  >
                    <RowContent
                      title={labels.exercise(entry.exerciseId)}
                      hint={t`${count}, last on ${date}`}
                    />
                  </Link>
                </li>
              );
            })}
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
