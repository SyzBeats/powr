import { Trans, useLingui } from '@lingui/react/macro';
import { useNavigate } from '@tanstack/react-router';
import { useState } from 'react';

import type { ExerciseId, LocalDate } from '@powr/domain';

import { TrendChart, type TrendSeries } from '#ui/charts/trend-chart';
import { ChipGroup } from '#ui/choice';
import { Card, Screen } from '#ui/screen';

import { useInsight } from '../../hooks/use-insights';
import { addLocalDays, formatLocalDateWithYear, todayLocal } from '../../i18n/format';
import { useLabels } from '../labels';
import { Loading } from './parts';
import { formatSignedPercent } from './words';

const round = (value: number) => Math.round(value * 10) / 10;

/** ANL-02: at most three series on one chart (three colours pass the colour-vision check). */
const MAX = 3;

/**
 * ANL-02 comparison: up to three exercises' smoothed estimated 1-rep max on one chart, each as
 * the % change from its first trend point in the range, so different lifts share one axis.
 */
export function CompareScreen({ ids }: { ids?: string | undefined }) {
  const { t } = useLingui();
  const labels = useLabels();
  const navigate = useNavigate();
  const chosen = (ids ? ids.split(',') : []) as ExerciseId[];
  const from = addLocalDays(todayLocal(), -365) as LocalDate;
  const trained = useInsight(`compare-trained:${from}`, async (insights, deps) => {
    const items = await insights.sessionHistory(deps, { from });
    const counts = new Map<ExerciseId, number>();
    for (const item of items) {
      for (const id of item.exerciseIds) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    return [...counts].toSorted((a, b) => b[1] - a[1]).map(([id]) => id);
  });
  const options = [...new Set([...chosen, ...(trained.loaded ? trained.value : [])])].map((id) => ({
    value: id,
    label: labels.exercise(id),
    disabled: chosen.length >= MAX,
  }));

  const choose = (next: ExerciseId[]) =>
    void navigate({
      to: '/progress/compare',
      search: next.length > 0 ? { ids: next.slice(0, MAX).join(',') } : {},
      replace: true,
    });

  return (
    <Screen title={t`Compare lifts`}>
      <Card>
        <p>
          <Trans>
            Choose up to three exercises. Each line shows how much its smoothed estimated 1-rep max
            changed since the start of the range, so lifts of any weight compare fairly.
          </Trans>
        </p>
        {!trained.loaded ? (
          <Loading />
        ) : options.length === 0 ? (
          <p className="text-fg-muted">
            <Trans>Finish a few workouts first: exercises you trained show here.</Trans>
          </p>
        ) : (
          <>
            <ChipGroup
              label={t`Exercises to compare, up to three`}
              options={options}
              value={chosen}
              onChange={choose}
            />
            <output className="block text-sm text-fg-muted">
              {chosen.length >= MAX ? (
                <Trans>Three chosen. Remove one to choose another.</Trans>
              ) : (
                <Trans>
                  {chosen.length} of {MAX} chosen.
                </Trans>
              )}
            </output>
          </>
        )}
      </Card>
      {chosen.length > 0 ? <ComparisonChart ids={chosen} /> : null}
    </Screen>
  );
}

function ComparisonChart({ ids }: { ids: readonly ExerciseId[] }) {
  const { t } = useLingui();
  const labels = useLabels();
  const [all, setAll] = useState(false);
  const range = all ? 'all' : '1y';
  const comparison = useInsight(`compare:${ids.join(',')}:${range}`, (insights, deps) =>
    insights.compareTrends(deps, { exerciseIds: ids, range, source: 'strength' }),
  );
  if (!comparison.loaded) return <Loading />;
  const series: TrendSeries[] = comparison.value.map((entry) => {
    const values = entry.points.map((point) => ({
      date: point.localDate,
      value: round(point.pct),
    }));
    return { name: labels.exercise(entry.exerciseId), points: values, trend: values };
  });
  const parts = comparison.value.flatMap((entry) => {
    const last = entry.points.at(-1);
    const name = labels.exercise(entry.exerciseId);
    const change = formatSignedPercent(last?.pct ?? 0);
    return last ? [t`${name}: ${change}`] : [];
  });
  const starts = comparison.value
    .map((entry) => entry.points[0]?.localDate)
    .filter((date): date is LocalDate => date !== undefined)
    .toSorted();
  const since = starts[0] ? formatLocalDateWithYear(starts[0]) : '';
  const list = new Intl.ListFormat(undefined, { type: 'conjunction' }).format(parts);
  const missing = comparison.value
    .filter((entry) => entry.points.length === 0)
    .map((entry) => labels.exercise(entry.exerciseId));
  const summary =
    parts.length === 0
      ? t`None of these exercises has a strength trend in this range yet.`
      : t`Change in smoothed estimated 1-rep max since ${since}: ${list}.`;
  return (
    <>
      <TrendChart
        measureId="compare"
        title={t`Strength trends compared`}
        summary={summary}
        series={series}
        unit="%"
        formatValue={formatSignedPercent}
        defaultRange="1y"
        endDate={todayLocal()}
        onRangeChange={(preset) => {
          if (preset === 'all') setAll(true);
        }}
        emptyText={t`No strength trend in this range yet.`}
      />
      {missing.length > 0 ? (
        <p className="text-sm text-fg-muted">
          <Trans>
            No strength trend yet for:{' '}
            {new Intl.ListFormat(undefined, { type: 'conjunction' }).format(missing)}. A trend needs
            sets with an effort rating.
          </Trans>
        </p>
      ) : null}
    </>
  );
}
