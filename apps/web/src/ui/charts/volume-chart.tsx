import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import type { BarSeriesOption, ScatterSeriesOption } from 'echarts/charts';
import { useMemo } from 'react';

import { formatLocalDate, formatLocalDateWithYear, formatNumber } from '../../i18n/format';
import { bandLabel, HeatSwatch, type HeatBand, type HeatStep } from '../body-map/heat';
import { Legend, LegendItem } from './parts';
import { dayMs, isoDay, type ChartWindow, type RangePreset } from './range';
import { useChartTheme, withAlpha, type ChartTheme } from './theme';
import { TimeChart, timeOption, type ChartRow } from './time-chart';

export interface VolumeWeek {
  /** The week's first day, `YYYY-MM-DD`. */
  readonly week: string;
  /** Fractional hard sets (EXL-05). */
  readonly sets: number;
  /** Direct hard sets, when shown. */
  readonly direct?: number;
  /** The week's band, from the same calculation as the heat map and the plan editor (ANL-03). */
  readonly step?: HeatStep;
}

export interface VolumeChartProps {
  readonly title: string;
  readonly summary: string;
  readonly weeks: readonly VolumeWeek[];
  /** The user's weekly target band, e.g. 10–20 fractional sets. */
  readonly target: { readonly low: number; readonly high: number };
  /**
   * The heat map's bands with their words (the same list `BodyMap` and `HeatLegend` take), for
   * the legend, the readout and the table.
   */
  readonly bands?: readonly HeatBand[];
  readonly headingLevel?: 2 | 3;
  readonly defaultRange?: RangePreset;
  /** The week the windows end on (default: the newest week). */
  readonly endDate?: string;
  readonly onRangeChange?: (preset: RangePreset | null, window: ChartWindow) => void;
  /** Drill-down to the week's contributing exercises (ANL-03). */
  readonly onOpen?: (week: string) => void;
  readonly openLabel?: string;
  readonly emptyText?: string;
  readonly className?: string;
  readonly measureId?: string;
}

const WEEK_MS = 7 * 86_400_000;
const NO_BANDS: readonly HeatBand[] = [];

/**
 * Weekly hard sets of one muscle against its target band (ANL-03): bars in the heat-map colour
 * of their band (`--heat-0…5`, MAP-04), "below the floor" hatched and "very high" cross-hatched
 * like the body map (never colour alone, NFR-A11Y-10), direct sets as a dash on each bar, and the
 * target band shaded between two dashed lines. Values match the heat map because the caller
 * passes the same calculation's numbers and bands.
 */
export function VolumeChart({
  title,
  summary,
  weeks,
  target,
  bands = NO_BANDS,
  headingLevel,
  defaultRange,
  endDate,
  onRangeChange,
  onOpen,
  openLabel,
  emptyText,
  className,
  measureId = 'volume',
}: VolumeChartProps) {
  const { t } = useLingui();
  const theme = useChartTheme();
  const words = useMemo<VolumeWords>(
    () => ({
      week: (day) => t`Week of ${day}`,
      sets: (value) => plural(value, { one: '# set', other: '# sets' }),
      direct: (value) => t`${formatNumber(value)} direct`,
      target: (low, high) => t`Target ${low} to ${high}`,
      axis: t`sets`,
    }),
    [t],
  );
  const sorted = useMemo(() => weeks.toSorted((a, b) => a.week.localeCompare(b.week)), [weeks]);
  const rows = useMemo(() => volumeRows(sorted, bands, words), [sorted, bands, words]);
  const { low, high } = target;
  const extent = useMemo(() => volumeExtent(sorted, endDate), [sorted, endDate]);
  const option = useMemo(
    () => volumeOption(theme, sorted, { low, high }, words, extent),
    [theme, sorted, low, high, words, extent],
  );
  const hasDirect = sorted.some((week) => week.direct !== undefined);
  const steps = bands.filter((band) => sorted.some((week) => week.step === band.step));

  const legend = (
    <Legend label={t`Legend`}>
      {steps.map((band) => (
        <li key={band.step} className="flex items-center gap-2">
          <HeatSwatch step={band.step} className="h-3 w-6" />
          <span>{band.label}</span>
        </li>
      ))}
      {steps.length === 0 ? (
        <LegendItem
          label={t`Hard sets`}
          swatch={<rect x="4" y="0" width="16" height="12" rx="2" className="fill-chart-1" />}
        />
      ) : null}
      {hasDirect ? (
        <LegendItem
          label={t`Direct sets`}
          swatch={<rect x="5" y="5" width="14" height="3" className="fill-fg" />}
        />
      ) : null}
      <LegendItem
        label={words.target(formatNumber(low), formatNumber(high))}
        swatch={
          <>
            <rect x="0" y="2" width="24" height="8" fillOpacity="0.25" className="fill-fg-muted" />
            <line x1="0" y1="2" x2="24" y2="2" strokeDasharray="3 2" className="stroke-fg-muted" />
            <line
              x1="0"
              y1="10"
              x2="24"
              y2="10"
              strokeDasharray="3 2"
              className="stroke-fg-muted"
            />
          </>
        }
      />
    </Legend>
  );

  return (
    <TimeChart
      measureId={measureId}
      title={title}
      summary={summary}
      headingLevel={headingLevel}
      rows={rows}
      columns={[t`Hard sets`, ...(hasDirect ? [t`Direct`] : []), t`Band`]}
      legend={legend}
      option={option}
      extent={extent}
      padMs={WEEK_MS / 2}
      defaultRange={defaultRange}
      endDay={endDate ? dayMs(endDate) : undefined}
      onRangeChange={onRangeChange}
      onOpen={onOpen ? (row) => onOpen(isoDay(row.x)) : undefined}
      openLabel={openLabel}
      emptyText={emptyText ?? t`No sets logged yet.`}
      className={className}
    />
  );
}

interface VolumeWords {
  week(day: string): string;
  sets(value: number): string;
  direct(value: number): string;
  target(low: string, high: string): string;
  /** The value axis name. */
  axis: string;
}

function volumeRows(
  weeks: readonly VolumeWeek[],
  bands: readonly HeatBand[],
  words: VolumeWords,
): ChartRow[] {
  const multiYear =
    weeks.length > 0 && weeks[0]!.week.slice(0, 4) !== weeks.at(-1)!.week.slice(0, 4);
  const hasDirect = weeks.some((week) => week.direct !== undefined);
  return weeks.map((week) => {
    const x = dayMs(week.week);
    const day = words.week(
      multiYear ? formatLocalDateWithYear(week.week) : formatLocalDate(week.week),
    );
    const band = bandLabel(bands, week.step);
    const cells = [
      formatNumber(week.sets),
      ...(hasDirect ? [week.direct === undefined ? '–' : formatNumber(week.direct)] : []),
      band ?? '–',
    ];
    const parts = [
      day,
      week.direct === undefined
        ? words.sets(week.sets)
        : `${words.sets(week.sets)} (${words.direct(week.direct)})`,
      ...(band ? [band] : []),
    ];
    return { x, y: week.sets, day, cells, readout: parts.join(' · ') };
  });
}

function volumeOption(
  theme: ChartTheme,
  weeks: readonly VolumeWeek[],
  target: { low: number; high: number },
  words: VolumeWords,
  extent: { min: number; max: number },
) {
  const fontSize = Math.round(theme.rem * 0.75);
  const stripe = withAlpha(theme.surface, 0.75);
  const decal = (step: HeatStep | undefined) =>
    step === 1
      ? {
          symbol: 'rect',
          symbolSize: 1,
          dashArrayX: [1, 0],
          dashArrayY: [2, 4],
          rotation: Math.PI / 4,
          color: stripe,
        }
      : step === 5
        ? {
            // A grid: one solid row, then three rows of 1-unit marks under each other, so the
            // marks join into the crossing lines; turned 45° it is the body map's cross-hatch.
            symbol: 'rect',
            symbolSize: 1,
            dashArrayX: [
              [1, 0],
              [1, 4],
              [1, 4],
              [1, 4],
              [1, 4],
            ],
            dashArrayY: [1, 0],
            rotation: Math.PI / 4,
            color: stripe,
          }
        : undefined;
  const bars: BarSeriesOption = {
    id: 'sets',
    type: 'bar',
    silent: true,
    barMaxWidth: Math.round(theme.rem * 1.5),
    barMinWidth: 3,
    itemStyle: { borderRadius: [4, 4, 0, 0] },
    data: weeks.map((week) => {
      const step = week.step;
      const decalStyle = decal(step);
      return {
        value: [dayMs(week.week), week.sets],
        itemStyle: {
          color: step === undefined ? theme.series[0] : theme.heat[step],
          ...(decalStyle ? { decal: decalStyle } : {}),
        },
      };
    }),
    markArea: {
      silent: true,
      itemStyle: { color: withAlpha(theme.fgMuted, 0.14) },
      data: [[{ yAxis: target.low }, { yAxis: target.high }]],
    },
    markLine: {
      silent: true,
      symbol: ['none', 'none'],
      lineStyle: { color: theme.fgMuted, type: 'dashed', width: 1 },
      label: {
        position: 'insideEndTop',
        color: theme.fgMuted,
        fontSize,
        formatter: (params: { value?: unknown }) => formatNumber(Number(params.value)),
      },
      data: [{ yAxis: target.low }, { yAxis: target.high }],
    },
  };
  const direct: ScatterSeriesOption = {
    id: 'direct',
    type: 'scatter',
    silent: true,
    z: 5,
    symbol: 'rect',
    symbolSize: [Math.round(theme.rem * 1.1), 3],
    // A surface edge keeps the dash visible on light and dark bars alike.
    itemStyle: { color: theme.fg, borderColor: theme.surface, borderWidth: 1 },
    data: weeks
      .filter((week) => week.direct !== undefined)
      .map((week) => [dayMs(week.week), week.direct!]),
  };
  const max = Math.max(target.high, ...weeks.map((week) => week.sets));
  return timeOption(theme, {
    series: [bars, direct],
    yAxis: {
      name: words.axis,
      scale: false,
      min: 0,
      max: Math.ceil((max * 1.1) / 5) * 5,
      nameGap: Math.round(theme.rem * 0.6),
    },
    extent,
  });
}

function volumeExtent(weeks: readonly VolumeWeek[], endDate: string | undefined) {
  const xs = weeks.map((week) => dayMs(week.week));
  if (xs.length === 0) return { min: 0, max: 0 };
  const end = Math.max(...xs, endDate ? dayMs(endDate) : 0);
  return { min: Math.min(...xs) - WEEK_MS / 2, max: end + WEEK_MS / 2 };
}
