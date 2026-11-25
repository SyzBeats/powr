import { useLingui } from '@lingui/react/macro';
import type { LineSeriesOption, ScatterSeriesOption } from 'echarts/charts';
import { useMemo } from 'react';

import { formatLocalDate, formatLocalDateWithYear, formatNumber } from '../../i18n/format';
import {
  BandSwatch,
  DiamondSwatch,
  Legend,
  LegendItem,
  LineSwatch,
  PointSwatch,
  SERIES_DASH,
  STAR_PATH,
  StarSwatch,
} from './parts';
import { dayMs, isoDay, type ChartWindow, type RangePreset } from './range';
import { useChartTheme, withAlpha, type ChartTheme } from './theme';
import { TimeChart, timeOption, type ChartRow } from './time-chart';

/** A measured value on a day, e.g. one session's e1RM or one weigh-in. */
export interface TrendPoint {
  /** `YYYY-MM-DD`. */
  readonly date: string;
  readonly value: number;
}

/** A point of the smoothed trend, with its uncertainty band when known (PRG-02: 95%). */
export interface TrendLinePoint extends TrendPoint {
  readonly low?: number;
  readonly high?: number;
}

/** PR (MOT-01) or a "likely real" / "very likely real" change (PRG-02). */
export type TrendMarkerKind = 'pr' | 'likely' | 'veryLikely';

export interface TrendMarker {
  readonly date: string;
  readonly kind: TrendMarkerKind;
  /** Words for the readout and the table, e.g. "PR: 142.5 kg × 3", "+4%, likely real". */
  readonly label: string;
}

export interface TrendSeries {
  readonly name: string;
  readonly points: readonly TrendPoint[];
  readonly trend?: readonly TrendLinePoint[];
  readonly markers?: readonly TrendMarker[];
}

/** A shaded span on the time axis: a block, a deload, a break (ANL-02 annotations). */
export interface ChartAnnotation {
  readonly from: string;
  readonly to: string;
  readonly label: string;
}

export interface TrendChartProps {
  readonly title: string;
  readonly summary: string;
  /** One series, or up to 3 to compare (ANL-02: normalised to % change by the caller). */
  readonly series: readonly TrendSeries[];
  /** The value axis name: "kg", "lb" or "%". */
  readonly unit: string;
  /** Values with their unit for the readout and the table: `(v) => formatMass(v, 'kg')`. */
  readonly formatValue?: (value: number) => string;
  readonly annotations?: readonly ChartAnnotation[];
  /** Words for the legend; defaults "Trend" and "Each session". */
  readonly labels?: { readonly trend?: string; readonly points?: string };
  readonly headingLevel?: 2 | 3;
  readonly defaultRange?: RangePreset;
  /** The day the windows end on (default: the newest point), usually today. */
  readonly endDate?: string;
  readonly onRangeChange?: (preset: RangePreset | null, window: ChartWindow) => void;
  /** Opens the underlying sets of a day (ANL-02); shows a button in the readout. */
  readonly onOpen?: (date: string) => void;
  readonly openLabel?: string;
  readonly emptyText?: string;
  readonly className?: string;
  /** Suffix of the performance entries (spike S-4). */
  readonly measureId?: string;
}

const SYMBOLS = ['circle', 'rect', 'triangle'] as const;
const DASHES = ['solid', [6, 3], [2, 3]] as const;
const DAY_MS = 86_400_000;
const NO_ANNOTATIONS: readonly ChartAnnotation[] = [];
const plainValue = (value: number) => formatNumber(value);

/**
 * e1RM and performance trends (ANL-02, PRG-02): per-session values as hollow points, the
 * smoothed trend as a line with its 95% band (dashed edges, so the band is visible beyond its
 * light fill), PR stars and "likely real" diamonds (the newest one labelled), annotations as
 * shaded spans; up to three series told apart by colour, dash and symbol. The same component
 * draws the bodyweight trend (`BodyweightChart`). Memoize `series` and `annotations`: a new
 * array redraws every series.
 */
export function TrendChart({
  title,
  summary,
  series,
  unit,
  formatValue: format = plainValue,
  annotations = NO_ANNOTATIONS,
  labels,
  headingLevel,
  defaultRange,
  endDate,
  onRangeChange,
  onOpen,
  openLabel,
  emptyText,
  className,
  measureId = 'trend',
}: TrendChartProps) {
  const { t } = useLingui();
  const theme = useChartTheme();
  const words = useMemo<TrendWords>(
    () => ({
      named: (name, value) => t`${name}: ${value}`,
      between: (low, high) => t`${low} to ${high}`,
      trend: (value) => t`trend ${value}`,
      band: (range) => t`95% range ${range}`,
    }),
    [t],
  );
  const shown = useMemo(() => series.slice(0, 3), [series]);
  const multi = shown.length > 1;
  const rows = useMemo(() => trendRows(shown, format, words), [shown, format, words]);
  const extent = useMemo(() => trendExtent(shown, endDate), [shown, endDate]);
  const option = useMemo(
    () => trendOption(theme, shown, annotations, unit, extent),
    [theme, shown, annotations, unit, extent],
  );

  const hasBand = shown.some((entry) => entry.trend?.some((point) => point.low !== undefined));
  const kinds = new Set(shown.flatMap((entry) => entry.markers ?? []).map((marker) => marker.kind));
  const legend = (
    <Legend label={t`Legend`}>
      {shown.map((entry, index) => (
        <LegendItem
          key={`line-${entry.name}`}
          label={multi ? entry.name : (labels?.trend ?? t`Trend`)}
          swatch={<LineSwatch series={seriesIndex(index)} dash={SERIES_DASH[index]} />}
        />
      ))}
      {shown.map((entry, index) =>
        multi || entry.points.length === 0 ? null : (
          <LegendItem
            key={`points-${entry.name}`}
            label={labels?.points ?? t`Each session`}
            swatch={<PointSwatch series={seriesIndex(index)} />}
          />
        ),
      )}
      {hasBand ? <LegendItem label={t`95% range`} swatch={<BandSwatch series={0} />} /> : null}
      {kinds.has('pr') ? <LegendItem label={t`PR`} swatch={<StarSwatch />} /> : null}
      {kinds.has('likely') ? (
        <LegendItem label={t`Likely real change`} swatch={<DiamondSwatch hollow />} />
      ) : null}
      {kinds.has('veryLikely') ? (
        <LegendItem label={t`Very likely real change`} swatch={<DiamondSwatch />} />
      ) : null}
    </Legend>
  );

  const columns = multi
    ? shown.map((entry) => entry.name)
    : [
        t`Value`,
        ...(shown[0]?.trend ? [t`Trend`] : []),
        ...(hasBand ? [t`95% range`] : []),
        t`Notes`,
      ];

  return (
    <TimeChart
      measureId={measureId}
      title={title}
      summary={summary}
      headingLevel={headingLevel}
      rows={rows}
      columns={columns}
      legend={legend}
      option={option}
      extent={extent}
      defaultRange={defaultRange}
      endDay={endDate ? dayMs(endDate) : undefined}
      onRangeChange={onRangeChange}
      onOpen={onOpen ? (row) => onOpen(isoDay(row.x)) : undefined}
      openLabel={openLabel}
      emptyText={emptyText ?? t`Nothing logged yet.`}
      className={className}
    />
  );
}

const seriesIndex = (index: number) => Math.min(2, Math.max(0, index)) as 0 | 1 | 2;

interface TrendWords {
  named(name: string, value: string): string;
  between(low: string, high: string): string;
  trend(value: string): string;
  band(range: string): string;
}

function trendExtent(series: readonly TrendSeries[], endDate: string | undefined) {
  const xs = series.flatMap((entry) => [
    ...entry.points.map((point) => dayMs(point.date)),
    ...(entry.trend ?? []).map((point) => dayMs(point.date)),
  ]);
  if (xs.length === 0) return { min: 0, max: 0 };
  const end = Math.max(...xs, endDate ? dayMs(endDate) : 0);
  return { min: Math.min(...xs) - DAY_MS / 2, max: end + DAY_MS / 2 };
}

function trendRows(
  series: readonly TrendSeries[],
  format: (value: number) => string,
  words: TrendWords,
): ChartRow[] {
  const days = new Set<string>();
  for (const entry of series) for (const point of entry.points) days.add(point.date);
  const sorted = [...days].toSorted();
  const multiYear = sorted.length > 0 && sorted[0]!.slice(0, 4) !== sorted.at(-1)!.slice(0, 4);
  const lookups = series.map((entry) => ({
    points: new Map(entry.points.map((point) => [point.date, point.value])),
    trend: new Map((entry.trend ?? []).map((point) => [point.date, point])),
    markers: Map.groupBy(entry.markers ?? [], (marker) => marker.date),
  }));
  const multi = series.length > 1;
  const hasTrend = series[0]?.trend !== undefined;
  const hasBand = series[0]?.trend?.some((point) => point.low !== undefined) ?? false;
  return sorted.map((date) => {
    const x = dayMs(date);
    const day = multiYear ? formatLocalDateWithYear(date) : formatLocalDate(date);
    if (multi) {
      const values = lookups.map((lookup) => lookup.points.get(date));
      const cells = values.map((value) => (value === undefined ? '–' : format(value)));
      const parts = series.flatMap((entry, index) =>
        values[index] === undefined ? [] : [words.named(entry.name, cells[index]!)],
      );
      const y = values.find((value) => value !== undefined);
      return { x, y: y ?? null, day, cells, readout: [day, ...parts].join(' · ') };
    }
    const lookup = lookups[0]!;
    const value = lookup.points.get(date)!;
    const trend = lookup.trend.get(date);
    const notes = (lookup.markers.get(date) ?? []).map((marker) => marker.label);
    const band =
      trend?.low !== undefined && trend.high !== undefined
        ? words.between(format(trend.low), format(trend.high))
        : null;
    const trendText = trend ? format(trend.value) : null;
    const cells = [
      format(value),
      ...(hasTrend ? [trendText ?? '–'] : []),
      ...(hasBand ? [band ?? '–'] : []),
      notes.join(', ') || '–',
    ];
    const parts = [
      day,
      format(value),
      ...(trendText ? [words.trend(trendText)] : []),
      ...(band ? [words.band(band)] : []),
      ...notes,
    ];
    return { x, y: value, day, cells, readout: parts.join(' · ') };
  });
}

function trendOption(
  theme: ChartTheme,
  series: readonly TrendSeries[],
  annotations: readonly ChartAnnotation[],
  unit: string,
  extent: { min: number; max: number },
) {
  const marks: (LineSeriesOption | ScatterSeriesOption)[] = [];
  const fontSize = Math.round(theme.rem * 0.75);
  series.forEach((entry, index) => {
    const colour = theme.series[seriesIndex(index)];
    const trend = entry.trend ?? [];
    const banded = trend.filter((point) => point.low !== undefined && point.high !== undefined);
    if (banded.length > 0) {
      const edge = { color: colour, width: 1, type: [3, 2] as number[], opacity: 0.9 };
      marks.push(
        {
          id: `band-low-${index}`,
          type: 'line',
          stack: `band-${index}`,
          silent: true,
          symbol: 'none',
          sampling: 'lttb',
          lineStyle: edge,
          data: banded.map((point) => [dayMs(point.date), point.low!]),
        },
        {
          id: `band-high-${index}`,
          type: 'line',
          stack: `band-${index}`,
          silent: true,
          symbol: 'none',
          sampling: 'lttb',
          lineStyle: edge,
          areaStyle: { color: withAlpha(colour, 0.18) },
          data: banded.map((point) => [dayMs(point.date), point.high! - point.low!]),
        },
      );
    }
    if (trend.length > 0) {
      marks.push({
        id: `trend-${index}`,
        type: 'line',
        silent: true,
        symbol: 'none',
        sampling: 'lttb',
        z: 3,
        lineStyle: { color: colour, width: 2.5, type: DASHES[index] as LineType },
        data: trend.map((point) => [dayMs(point.date), point.value]),
      });
    }
    // Compared lifts show their trends only: three clouds of raw points would hide the lines
    // (the table still lists every session's value).
    const points = series.length > 1 && trend.length > 0 ? [] : entry.points;
    marks.push({
      id: `points-${index}`,
      type: 'scatter',
      silent: true,
      z: 4,
      symbol: SYMBOLS[index] ?? 'circle',
      symbolSize: Math.round(theme.rem * 0.45),
      itemStyle: { color: theme.surface, borderColor: colour, borderWidth: 1.5 },
      data: points.map((point) => [dayMs(point.date), point.value]),
      ...(index === 0 && annotations.length > 0
        ? {
            markArea: {
              silent: true,
              itemStyle: { color: withAlpha(theme.fgMuted, 0.12) },
              label: { color: theme.fgMuted, fontSize, position: 'insideTop' },
              data: annotations.map((annotation) => [
                { name: annotation.label, xAxis: dayMs(annotation.from) },
                { xAxis: dayMs(annotation.to) + DAY_MS - 1 },
              ]),
            },
          }
        : {}),
    });
    const values = new Map(entry.points.map((point) => [point.date, point.value]));
    const trendValues = new Map(trend.map((point) => [point.date, point.value]));
    const markers = entry.markers ?? [];
    const prs = markers.filter((marker) => marker.kind === 'pr');
    if (prs.length > 0) {
      marks.push({
        id: `pr-${index}`,
        type: 'scatter',
        silent: true,
        z: 6,
        symbol: `path://${STAR_PATH}`,
        symbolSize: Math.round(theme.rem * 1.1),
        itemStyle: { color: theme.prAccent, borderColor: theme.surface, borderWidth: 1 },
        data: prs.map((marker) => [
          dayMs(marker.date),
          values.get(marker.date) ?? trendValues.get(marker.date) ?? 0,
        ]),
      });
    }
    const changes = markers
      .filter((marker) => marker.kind !== 'pr')
      .toSorted((a, b) => a.date.localeCompare(b.date));
    if (changes.length > 0) {
      const newest = changes.at(-1)!;
      marks.push({
        id: `change-${index}`,
        type: 'scatter',
        silent: true,
        z: 7,
        symbol: 'diamond',
        symbolSize: Math.round(theme.rem * 0.85),
        data: changes.map((marker) => ({
          value: [dayMs(marker.date), trendValues.get(marker.date) ?? values.get(marker.date) ?? 0],
          itemStyle:
            marker.kind === 'veryLikely'
              ? { color: theme.fg, borderColor: theme.surface, borderWidth: 1.5 }
              : { color: theme.surface, borderColor: theme.fg, borderWidth: 2 },
          // Selective direct labels: only the newest change is named on the canvas.
          label:
            marker === newest
              ? {
                  show: true,
                  // To the left: the newest change sits near the right edge of the plot.
                  position: 'left',
                  distance: 6,
                  formatter: marker.label,
                  color: theme.fg,
                  fontSize,
                  backgroundColor: theme.surface,
                  borderColor: theme.control,
                  borderWidth: 1,
                  borderRadius: 4,
                  padding: [2, 4],
                }
              : { show: false },
        })),
      });
    }
  });
  return timeOption(theme, {
    series: marks,
    yAxis: { name: unit, nameGap: Math.round(theme.rem * 0.6) },
    extent,
  });
}

type LineType = NonNullable<NonNullable<LineSeriesOption['lineStyle']>['type']>;
