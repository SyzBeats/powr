import { Toggle } from '@base-ui/react/toggle';
import { ToggleGroup } from '@base-ui/react/toggle-group';
import { Trans, useLingui } from '@lingui/react/macro';
import type { XAXisComponentOption, YAXisComponentOption } from 'echarts';
import type { ScatterSeriesOption } from 'echarts/charts';
import type { EChartsCoreOption } from 'echarts/core';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useId, useMemo, useState, type KeyboardEvent, type ReactNode } from 'react';

import { Button } from '#ui/button';
import { cn } from '#ui/cn';

import { formatAxisDate, formatNumber, formatSpan } from '../../i18n/format';
import { EChart } from './echart';
import { DataTable } from './parts';
import {
  presetWindow,
  RANGE_PRESETS,
  shiftWindow,
  type ChartWindow,
  type RangePreset,
} from './range';
import type { ChartTheme } from './theme';

/**
 * One navigable point of a time chart: where the selection marker sits, the readout line (the
 * chart's "tooltip", HTML so it scales with the text size and needs no `innerHTML`) and the
 * table cells after the date column.
 */
export interface ChartRow {
  /** Epoch ms of the day (UTC midnight). Rows are in ascending order. */
  readonly x: number;
  /** Where the selection ring sits; null puts it on the axis. */
  readonly y: number | null;
  /** The date as shown in the table and the readout. */
  readonly day: string;
  /** "Tue, 12 Nov · 142.5 kg · PR" */
  readonly readout: string;
  /** Table cells after the date. */
  readonly cells: readonly string[];
}

export interface TimeChartProps {
  /** Performance entry suffix (spike S-4). */
  readonly measureId: string;
  readonly title: string;
  /** One sentence for screen readers and everyone else: "Squat e1RM rose 4% over 12 weeks". */
  readonly summary: string;
  readonly headingLevel?: 2 | 3 | undefined;
  readonly rows: readonly ChartRow[];
  /** Table column headers after "Date". */
  readonly columns: readonly string[];
  readonly legend?: ReactNode;
  /** The chart built with `timeOption` (memoize it: a new object re-renders every series). */
  readonly option: EChartsCoreOption;
  /** The x axis' extent as given to `timeOption` (padded), to map pinch percentages to days. */
  readonly extent: { readonly min: number; readonly max: number };
  /** Extra time shown before the first and after the last point (half a bar for weekly bars). */
  readonly padMs?: number | undefined;
  readonly defaultRange?: RangePreset | undefined;
  /** The newest day the windows end on (default: the newest row), e.g. today. */
  readonly endDay?: number | undefined;
  /** A range chip, a pinch, a pan or Earlier/Later changed the window (preset null: custom). */
  readonly onRangeChange?: ((preset: RangePreset | null, window: ChartWindow) => void) | undefined;
  /** "Show the sets" for the selected point (ANL-02: tapping a point shows its sets). */
  readonly onOpen?: ((row: ChartRow) => void) | undefined;
  readonly openLabel?: string | undefined;
  readonly emptyText: string;
  readonly className?: string | undefined;
}

const HALF_DAY_MS = 43_200_000;

/**
 * The shared frame of the time charts (ANL-11, NFR-A11Y-06): title and one-sentence summary,
 * range chips (4 weeks, 12 weeks, 6 months, 1 year, all), the canvas with pinch-zoom and pan,
 * a tap for a point's values in an HTML readout, a point slider for the keyboard and screen
 * readers (arrow keys, Home, End; TalkBack swipes up and down), Earlier/Later buttons as the tap
 * alternative to panning, a legend and "View as table". Every value is in the table, so colour,
 * the canvas and gestures are never the only way to the data.
 */
export function TimeChart({
  measureId,
  title,
  summary,
  headingLevel = 2,
  rows,
  columns,
  legend,
  option,
  extent,
  padMs = HALF_DAY_MS,
  defaultRange = '12w',
  endDay,
  onRangeChange,
  onOpen,
  openLabel,
  emptyText,
  className,
}: TimeChartProps) {
  const { t } = useLingui();
  const ids = useId();
  const titleId = `${ids}-title`;
  const summaryId = `${ids}-summary`;
  const first = rows[0]?.x ?? 0;
  const last = Math.max(rows.at(-1)?.x ?? 0, endDay ?? 0);
  // A preset window follows the data (a new session moves "12 weeks" along, data that arrives
  // after a loading state gets its window); a pinched or shifted window stays where it is.
  const [range, setRange] = useState<
    { readonly preset: RangePreset } | { readonly preset: null; readonly frame: ChartWindow }
  >({ preset: defaultRange });
  const preset = range.preset;
  const frame = range.preset ? presetWindow(range.preset, first, last) : range.frame;
  // The selection is a day, so it survives new rows.
  const [selectedX, setSelectedX] = useState<number | null>(null);
  const selected = selectedX === null ? -1 : rows.findIndex((row) => row.x === selectedX);
  const shownFrom = frame.from - padMs;
  const shownTo = frame.to + padMs;
  const selectedRow = rows[selected] ?? null;

  const overlay = useMemo<EChartsCoreOption>(() => {
    const span = shownTo - shownFrom;
    return {
      dataZoom: [{ id: 'zoom', startValue: shownFrom, endValue: shownTo }],
      xAxis: [
        {
          id: 'x',
          axisLabel: { formatter: (value: number) => formatAxisDate(value, span) },
        } satisfies XAXisComponentOption,
      ],
      series: [
        {
          id: 'selection',
          data: selectedRow ? [[selectedRow.x, selectedRow.y ?? 0]] : [],
          markLine: { data: selectedRow ? [{ xAxis: selectedRow.x }] : [] },
        } satisfies ScatterSeriesOption,
      ],
    };
  }, [shownFrom, shownTo, selectedRow]);

  if (rows.length === 0) {
    return (
      <ChartSection
        className={className}
        headingLevel={headingLevel}
        title={title}
        titleId={titleId}
        summary={summary}
        summaryId={summaryId}
      >
        <p className="text-fg-muted">{emptyText}</p>
      </ChartSection>
    );
  }

  const choosePreset = (next: RangePreset) => {
    setRange({ preset: next });
    onRangeChange?.(next, presetWindow(next, first, last));
  };
  const changeWindow = (next: ChartWindow) => {
    setRange({ preset: null, frame: next });
    onRangeChange?.(null, next);
  };
  const visibleIndexes = () => {
    const from = rows.findIndex((row) => row.x >= shownFrom);
    const to = rows.findLastIndex((row) => row.x <= shownTo);
    return from < 0 || to < from ? null : { from, to };
  };

  const select = (index: number) => {
    const row = rows[index];
    if (!row) return;
    setSelectedX(row.x);
    // Stepping past the window's edge moves the window with the selection.
    if (row.x < shownFrom || row.x > shownTo) {
      const span = frame.to - frame.from;
      changeWindow(
        row.x < shownFrom ? { from: row.x, to: row.x + span } : { from: row.x - span, to: row.x },
      );
    }
  };

  const pick = (x: number) => {
    const visible = visibleIndexes();
    if (!visible) return;
    let best = visible.from;
    for (let index = visible.from; index <= visible.to; index++) {
      if (Math.abs(rows[index]!.x - x) < Math.abs(rows[best]!.x - x)) best = index;
    }
    setSelectedX(rows[best]!.x);
  };

  const onZoom = (startPercent: number, endPercent: number) => {
    const span = extent.max - extent.min;
    const from = extent.min + (span * startPercent) / 100;
    const to = extent.min + (span * endPercent) / 100;
    changeWindow({ from: from + padMs, to: to - padMs });
  };

  const sliderValue = selected >= 0 ? selected : (visibleIndexes()?.to ?? rows.length - 1);
  const onSliderKey = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && selectedRow && onOpen) {
      event.preventDefault();
      onOpen(selectedRow);
    } else if (event.key === 'Escape' && selectedX !== null) {
      event.preventDefault();
      setSelectedX(null);
    }
  };

  const presetLabel = (value: RangePreset) =>
    value === '4w'
      ? formatSpan(4, 'week')
      : value === '12w'
        ? formatSpan(12, 'week')
        : value === '6m'
          ? formatSpan(6, 'month')
          : value === '1y'
            ? formatSpan(1, 'year')
            : t`All`;
  const rangeText = preset ? presetLabel(preset) : t`Custom range`;
  const visible = rows.filter((row) => row.x >= shownFrom && row.x <= shownTo);

  return (
    <ChartSection
      className={className}
      headingLevel={headingLevel}
      title={title}
      titleId={titleId}
      summary={summary}
      summaryId={summaryId}
    >
      <ToggleGroup
        aria-label={t`Time range`}
        value={preset === null ? [] : [preset]}
        onValueChange={(next) => {
          const chosen = next[0];
          if (chosen !== undefined) choosePreset(chosen);
        }}
        // One row of five at 360 px; they wrap at 320 px or 200% text (NFR-A11Y-07).
        className="flex flex-wrap gap-1.5"
      >
        {RANGE_PRESETS.map((value) => (
          <Toggle
            key={value}
            value={value}
            className="min-h-target flex-1 basis-auto rounded-xl border border-control bg-surface px-2 text-sm font-medium whitespace-nowrap text-fg data-[pressed]:border-primary data-[pressed]:bg-primary data-[pressed]:text-on-primary"
          >
            {presetLabel(value)}
          </Toggle>
        ))}
      </ToggleGroup>
      <Readout
        row={selectedRow}
        onOpen={onOpen && selectedRow ? () => onOpen(selectedRow) : undefined}
        openLabel={openLabel}
      />
      {/* The focus ring of the point slider is drawn around the chart it controls. */}
      <div className="relative rounded-xl has-[input:focus-visible]:outline-3 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus">
        <EChart
          measureId={measureId}
          option={option}
          overlay={overlay}
          className="h-64"
          onPick={pick}
          onZoom={onZoom}
          fallback={
            <p className="rounded-xl bg-surface-raised p-3 text-fg-muted">
              <Trans>The chart could not be loaded. The table below has every value.</Trans>
            </p>
          }
        />
        <input
          type="range"
          className="sr-only"
          min={0}
          max={rows.length - 1}
          step={1}
          value={sliderValue}
          aria-label={t`Points of ${title}`}
          aria-valuetext={rows[sliderValue]?.readout}
          aria-describedby={summaryId}
          onFocus={() => setSelectedX(rows[sliderValue]?.x ?? null)}
          onChange={(event) => select(Number(event.target.value))}
          onKeyDown={onSliderKey}
        />
      </div>
      {legend}
      <div className="flex flex-wrap items-center gap-2">
        <Button
          disabled={frame.from <= first}
          onClick={() => changeWindow(shiftWindow(frame, -1, first, last))}
        >
          <ChevronLeft aria-hidden="true" />
          <Trans>Earlier</Trans>
        </Button>
        <Button
          disabled={frame.to >= last}
          onClick={() => changeWindow(shiftWindow(frame, 1, first, last))}
        >
          <Trans>Later</Trans>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>
      <DataTable
        caption={t`${title}, ${rangeText}, newest first`}
        columns={[t`Date`, ...columns]}
        rows={visible
          .toReversed()
          .map((row) => ({ key: String(row.x), cells: [row.day, ...row.cells] }))}
      />
    </ChartSection>
  );
}

function ChartSection({
  headingLevel,
  title,
  titleId,
  summary,
  summaryId,
  className,
  children,
}: {
  headingLevel: 2 | 3;
  title: string;
  titleId: string;
  summary: string;
  summaryId: string;
  className?: string | undefined;
  children: ReactNode;
}) {
  const Heading = headingLevel === 3 ? 'h3' : 'h2';
  return (
    <section
      aria-labelledby={titleId}
      className={cn('flex min-w-0 flex-col gap-3 rounded-2xl bg-surface p-4', className)}
    >
      <div className="flex flex-col gap-1">
        <Heading id={titleId} className="text-lg font-semibold">
          {title}
        </Heading>
        <p id={summaryId}>{summary}</p>
      </div>
      {children}
    </section>
  );
}

/**
 * The selected point's values (the chart's tooltip) above the canvas, with a fixed minimum
 * height so a tap never shifts the chart. Not a live region: the point slider's value text
 * already speaks the same words, and a tap is a sighted gesture.
 */
function Readout({
  row,
  onOpen,
  openLabel,
}: {
  row: ChartRow | null;
  onOpen?: (() => void) | undefined;
  openLabel?: string | undefined;
}) {
  return (
    <div
      data-testid="chart-readout"
      className="flex min-h-target flex-wrap items-center gap-2 rounded-xl bg-surface-raised px-3 py-2"
    >
      {row ? (
        <p className="min-w-0 flex-1 font-medium tabular">{row.readout}</p>
      ) : (
        <p className="text-sm text-fg-muted">
          <Trans>Tap the chart or use the arrow keys to see a point's values.</Trans>
        </p>
      )}
      {row && onOpen && openLabel ? (
        <Button variant="ghost" onClick={onOpen}>
          {openLabel}
        </Button>
      ) : null}
    </div>
  );
}

/** The parts every time chart shares: grid, axes, the inside zoom and the selection marker. */
export function timeOption(
  theme: ChartTheme,
  {
    series,
    yAxis,
    extent,
  }: {
    series: readonly object[];
    yAxis?: YAXisComponentOption;
    /** The data's first and last x (padded), so the zoom percentages map back to days. */
    extent: { readonly min: number; readonly max: number };
  },
): EChartsCoreOption {
  const label = {
    color: theme.fgMuted,
    fontFamily: theme.fontFamily,
    fontSize: Math.round(theme.rem * 0.75),
  };
  return {
    animation: !theme.reducedMotion,
    animationDurationUpdate: theme.reducedMotion ? 0 : 200,
    textStyle: { fontFamily: theme.fontFamily, color: theme.fg },
    grid: {
      left: 4,
      right: Math.round(theme.rem * 0.75),
      top: Math.round(theme.rem * 1.75),
      bottom: 4,
      outerBoundsMode: 'same',
      outerBoundsContain: 'axisLabel',
    },
    xAxis: [
      {
        id: 'x',
        type: 'time',
        min: extent.min,
        max: extent.max,
        axisLine: { lineStyle: { color: theme.control } },
        axisTick: { lineStyle: { color: theme.control } },
        axisLabel: { ...label, hideOverlap: true },
        splitLine: { show: false },
      } satisfies XAXisComponentOption,
    ],
    yAxis: [
      {
        id: 'y',
        type: 'value',
        scale: true,
        nameTextStyle: { ...label, align: 'left' },
        axisLabel: { ...label, formatter: (value: number) => formatNumber(value) },
        splitLine: { lineStyle: { color: theme.border } },
        ...yAxis,
      } as YAXisComponentOption,
    ],
    dataZoom: [
      {
        id: 'zoom',
        type: 'inside',
        xAxisIndex: 0,
        filterMode: 'filter',
        zoomOnMouseWheel: true,
        moveOnMouseMove: true,
        moveOnMouseWheel: false,
        // At least about a week visible, so a pinch cannot zoom into an empty axis.
        minValueSpan: 7 * 86_400_000,
      },
    ],
    series: [
      ...series,
      {
        id: 'selection',
        type: 'scatter',
        data: [],
        z: 10,
        silent: true,
        animation: false,
        symbol: 'circle',
        symbolSize: Math.round(theme.rem),
        itemStyle: { color: 'transparent', borderColor: theme.fg, borderWidth: 3 },
        markLine: {
          silent: true,
          animation: false,
          symbol: ['none', 'none'],
          label: { show: false },
          lineStyle: { color: theme.fgMuted, type: 'dashed', width: 1 },
          data: [],
        },
      } satisfies ScatterSeriesOption,
    ],
  };
}
