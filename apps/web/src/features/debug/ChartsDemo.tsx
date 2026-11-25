import { useEffect, useState } from 'react';

import { BodyweightChart } from '#ui/charts/bodyweight-chart';
import { CHART_MEASURES } from '#ui/charts/echart';
import { TrainingCalendar } from '#ui/charts/training-calendar';
import { TrendChart } from '#ui/charts/trend-chart';
import { VolumeChart } from '#ui/charts/volume-chart';
import { Screen } from '#ui/screen';

import {
  annotations,
  bodyweight,
  calendarDays,
  comparison,
  DEMO_END,
  squat,
  volume,
  volumeBands,
} from './chart-demo-data';

const SQUAT = [squat];
const kg = (value: number) =>
  new Intl.NumberFormat(navigator.language, {
    style: 'unit',
    unit: 'kilogram',
    unitDisplay: 'short',
    maximumFractionDigits: 1,
  }).format(value);
const percent = (value: number) =>
  `${new Intl.NumberFormat(navigator.language, { maximumFractionDigits: 1, signDisplay: 'exceptZero' }).format(value)}%`;

/**
 * `/debug/charts` (spike S-4, behind `?debug=1`): every chart of `src/ui/charts` with five years
 * of synthetic data, and the render, update and zoom timings the charts record as performance
 * measures. English only: a developer page, not product UI.
 */
export default function ChartsDemo() {
  const [month, setMonth] = useState('2026-11');
  return (
    <Screen title="Charts (S-4)">
      <p className="text-fg-muted">
        Synthetic data: five years, {squat.points.length} squat sessions,{' '}
        {bodyweight.entries.length} weigh-ins, {volume.length} weeks of volume.
      </p>
      <TrendChart
        measureId="squat"
        title="Squat e1RM"
        summary="Squat e1RM rose 4% over 12 weeks; the last change is likely real."
        series={SQUAT}
        unit="kg"
        formatValue={kg}
        annotations={annotations}
        endDate={DEMO_END}
        openLabel="Show the sets"
        onOpen={() => undefined}
      />
      <TrendChart
        measureId="compare"
        title="Squat, bench and deadlift"
        summary="Since the start, squat rose most, then bench press and deadlift."
        series={comparison}
        unit="%"
        formatValue={percent}
        endDate={DEMO_END}
        defaultRange="all"
      />
      <VolumeChart
        title="Chest: weekly hard sets"
        summary="Chest was in its 10 to 20 set target in 9 of the last 12 weeks."
        weeks={volume}
        target={TARGET}
        bands={volumeBands}
        endDate={DEMO_END}
      />
      <BodyweightChart
        title="Bodyweight"
        summary="Down 0.3 kg a week over the last 4 weeks."
        entries={bodyweight.entries}
        trend={bodyweight.trend}
        unit="kg"
        formatValue={kg}
        endDate={DEMO_END}
        defaultRange="6m"
      />
      <TrainingCalendar
        title="Training calendar"
        summary="7 workouts in November so far, 1 partly done, 1 missed."
        month={month}
        weekStart={1}
        days={calendarDays}
        today={DEMO_END}
        onMonthChange={setMonth}
        onDaySelect={() => undefined}
      />
      <Timings />
    </Screen>
  );
}

const TARGET = { low: 10, high: 20 };

interface Timing {
  readonly name: string;
  readonly ms: number;
}

/** Every chart performance measure so far (render, update, zoom), newest last. */
function Timings() {
  const [timings, setTimings] = useState<readonly Timing[]>([]);
  useEffect(() => {
    const read = () =>
      performance
        .getEntriesByType('measure')
        .filter((entry) =>
          Object.values(CHART_MEASURES).some((name) => entry.name.startsWith(name)),
        )
        .map((entry) => ({ name: entry.name, ms: Math.round(entry.duration * 10) / 10 }));
    const observer = new PerformanceObserver(() => setTimings(read()));
    observer.observe({ type: 'measure', buffered: true });
    return () => observer.disconnect();
  }, []);
  return (
    <section
      aria-labelledby="chart-timings"
      className="flex flex-col gap-2 rounded-2xl bg-surface p-4"
    >
      <h2 id="chart-timings" className="text-lg font-semibold">
        Timings
      </h2>
      <pre data-testid="chart-timings" className="text-xs whitespace-pre-wrap tabular">
        {JSON.stringify(timings)}
      </pre>
    </section>
  );
}
