import type { EChartsCoreOption, EChartsType } from 'echarts/core';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { cn } from '#ui/cn';

import type * as RuntimeModule from './echarts-runtime';

let runtime: Promise<typeof RuntimeModule> | null = null;

/** The lazy ECharts chunk (§8.10, §8.19), loaded once by the first chart that renders. */
function loadChartRuntime(): Promise<typeof RuntimeModule> {
  runtime ??= import('./echarts-runtime');
  return runtime;
}

/** Performance entry names (§8.19 "marks around setOption"; spike S-4 reads them). */
export const CHART_MEASURES = {
  render: 'powr-chart-render',
  update: 'powr-chart-update',
  zoom: 'powr-chart-zoom',
} as const;
type MeasureName = (typeof CHART_MEASURES)[keyof typeof CHART_MEASURES];

/**
 * The own ECharts wrapper of §8.10 (init, `ResizeObserver`, `setOption`, `dispose`, events):
 * `option` is the whole chart and replaces the previous one; `overlay` is merged on top (the
 * window and the selected point), so a tap or a range change never rebuilds the series.
 *
 * The canvas is hidden from assistive technology: the chart's summary, its point slider and its
 * table carry the same information in HTML (NFR-A11Y-06). `onPick` gets the x value (epoch ms)
 * under a tap in the plot; `onZoom` the window after a pinch or pan, as start and end
 * percentages of the axis. Each render, update and zoom is measured (`CHART_MEASURES`).
 */
export function EChart({
  measureId,
  option,
  overlay,
  className,
  onPick,
  onZoom,
  fallback,
}: {
  /** Suffix of the performance entries (`powr-chart-render:<id>`). */
  measureId: string;
  option: EChartsCoreOption;
  overlay: EChartsCoreOption;
  className?: string | undefined;
  onPick?: ((x: number) => void) | undefined;
  onZoom?: ((startPercent: number, endPercent: number) => void) | undefined;
  /** Shown instead of the canvas when the chart chunk cannot be loaded (offline, not cached). */
  fallback: ReactNode;
}) {
  const host = useRef<HTMLDivElement>(null);
  const [chart, setChart] = useState<EChartsType | null>(null);
  const [failed, setFailed] = useState(false);
  const latest = useRef({ onPick, onZoom, overlay, measureId });
  const pending = useRef<MeasureName | null>(null);

  useEffect(() => {
    latest.current = { onPick, onZoom, overlay, measureId };
  });

  useEffect(() => {
    const element = host.current;
    if (!element) return undefined;
    let disposed = false;
    let instance: EChartsType | null = null;
    let observer: ResizeObserver | null = null;
    const mark = (name: MeasureName) => {
      pending.current = name;
      performance.mark(`${name}:${latest.current.measureId}:start`);
    };
    loadChartRuntime()
      .then(({ createChart }) => {
        if (disposed) return;
        const created = createChart(element);
        instance = created;
        observer = new ResizeObserver(() => created.resize());
        observer.observe(element);
        created.getZr().on('click', (event) => {
          const point = [event.offsetX, event.offsetY];
          if (!created.containPixel({ gridIndex: 0 }, point)) return;
          const [x] = created.convertFromPixel({ gridIndex: 0 }, point);
          if (x !== undefined && Number.isFinite(x)) latest.current.onPick?.(x);
        });
        created.on('datazoom', (params) => {
          const event = params as ZoomEvent;
          const zoom = event.batch?.[0] ?? event;
          if (zoom.start === undefined || zoom.end === undefined) return;
          mark(CHART_MEASURES.zoom);
          latest.current.onZoom?.(zoom.start, zoom.end);
        });
        created.on('rendered', () => {
          const name = pending.current;
          if (!name) return;
          pending.current = null;
          const entry = `${name}:${latest.current.measureId}`;
          performance.measure(entry, `${entry}:start`);
          performance.clearMarks(`${entry}:start`);
        });
        setChart(created);
      })
      .catch(() => {
        if (!disposed) setFailed(true);
      });
    return () => {
      disposed = true;
      observer?.disconnect();
      instance?.dispose();
    };
  }, []);

  useEffect(() => {
    if (!chart) return;
    pending.current = CHART_MEASURES.render;
    performance.mark(`${CHART_MEASURES.render}:${latest.current.measureId}:start`);
    chart.setOption(option, { notMerge: true });
    chart.setOption(latest.current.overlay);
  }, [chart, option]);

  useEffect(() => {
    if (!chart) return;
    if (pending.current === null) {
      pending.current = CHART_MEASURES.update;
      performance.mark(`${CHART_MEASURES.update}:${latest.current.measureId}:start`);
    }
    chart.setOption(overlay);
  }, [chart, overlay]);

  if (failed) return fallback;
  return (
    <div
      ref={host}
      aria-hidden="true"
      data-chart-ready={chart ? '' : undefined}
      // Vertical swipes scroll the page natively; horizontal drags pan and pinches zoom the chart.
      className={cn('w-full touch-pan-y', className)}
    />
  );
}

interface ZoomEvent {
  readonly start?: number;
  readonly end?: number;
  readonly batch?: readonly { readonly start?: number; readonly end?: number }[];
}
