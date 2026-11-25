import { useLingui } from '@lingui/react/macro';
import { useMemo } from 'react';

import { TrendChart, type TrendChartProps, type TrendPoint } from './trend-chart';

export interface BodyweightChartProps extends Omit<
  TrendChartProps,
  'series' | 'labels' | 'annotations'
> {
  /** Every weigh-in (raw points, drawn de-emphasised: small and hollow). */
  readonly entries: readonly TrendPoint[];
  /** The smoothed trend (BOD-02: the EMA), drawn prominently. */
  readonly trend: readonly TrendPoint[];
}

/**
 * Bodyweight over time (BOD-02): the trend line prominent, raw weigh-ins de-emphasised, the
 * weekly rate in the summary sentence (the caller's words, e.g. "Down 0.4 kg a week over the
 * last 4 weeks"). No alert on a single day's weight; the same frame, range chips, readout and
 * table as the other time charts.
 */
export function BodyweightChart({ entries, trend, title, ...rest }: BodyweightChartProps) {
  const { t } = useLingui();
  const series = useMemo(() => [{ name: title, points: entries, trend }], [title, entries, trend]);
  return (
    <TrendChart
      measureId="bodyweight"
      {...rest}
      title={title}
      series={series}
      labels={{ trend: t`Trend`, points: t`Weigh-ins` }}
      emptyText={rest.emptyText ?? t`No weigh-ins yet.`}
    />
  );
}
