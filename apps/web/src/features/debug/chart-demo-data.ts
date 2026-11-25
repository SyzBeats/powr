import type { HeatBand, HeatStep } from '#ui/body-map/heat';
import type { CalendarDay, CalendarStatus } from '#ui/charts/training-calendar';
import type { ChartAnnotation, TrendMarker, TrendSeries } from '#ui/charts/trend-chart';
import type { VolumeWeek } from '#ui/charts/volume-chart';

/**
 * Synthetic, seeded data for the chart demo and spike S-4 (§8.10): five years of training, as
 * much as the reference dataset (A-11) holds for one lift (about 1,300 sessions), 1,800
 * weigh-ins and 260 weeks of volume. Deterministic, so screenshots and timings compare.
 */
export const DEMO_END = '2026-11-20';
const DAY_MS = 86_400_000;
const YEARS = 5;

function prng(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

const day = (epoch: number) => new Date(epoch).toISOString().slice(0, 10);
const endMs = Date.parse(`${DEMO_END}T00:00:00Z`);
const startMs = endMs - YEARS * 365 * DAY_MS;
const round = (value: number, step = 0.1) => Math.round(value / step) * step;

/** A lift's sessions: e1RM per session (noisy), the smoothed trend with a 95% band, markers. */
function lift(name: string, seed: number, base: number, perYear: number, weekly: number) {
  const random = prng(seed);
  const points: { date: string; value: number }[] = [];
  const trend: { date: string; value: number; low: number; high: number }[] = [];
  const markers: TrendMarker[] = [];
  let smoothed = base;
  let best = 0;
  let lastChange = startMs;
  let lastTrendAtChange = base;
  for (let at = startMs; at <= endMs; at += DAY_MS) {
    const weekday = new Date(at).getUTCDay();
    // `weekly` sessions a week on fixed weekdays; two breaks of three weeks.
    const trains = weekly >= 5 ? weekday !== 0 && weekday !== 6 : [1, 3, 5].includes(weekday);
    const years = (at - startMs) / (365 * DAY_MS);
    const onBreak = (years > 1.4 && years < 1.46) || (years > 3.8 && years < 3.86);
    if (!trains || onBreak) continue;
    const expected = base * (1 + perYear * Math.log1p(years * 1.4));
    const value = round(expected * (1 + (random() - 0.5) * 0.08));
    smoothed = smoothed + 0.12 * (value - smoothed);
    const width = smoothed * (0.018 + 0.012 * random());
    const date = day(at);
    points.push({ date, value });
    trend.push({
      date,
      value: round(smoothed),
      low: round(smoothed - width),
      high: round(smoothed + width),
    });
    if (value > best) {
      if (best > 0 && random() < 0.6) markers.push({ date, kind: 'pr', label: `PR: ${value} kg` });
      best = value;
    }
    if (at - lastChange > 56 * DAY_MS) {
      const change = (smoothed - lastTrendAtChange) / lastTrendAtChange;
      if (Math.abs(change) > 0.02) {
        const percent = `${change > 0 ? '+' : ''}${Math.round(change * 100)}%`;
        const very = Math.abs(change) > 0.05;
        markers.push({
          date,
          kind: very ? 'veryLikely' : 'likely',
          label: `${percent}, ${very ? 'very likely real' : 'likely real'}`,
        });
      }
      lastChange = at;
      lastTrendAtChange = smoothed;
    }
  }
  return { name, points, trend, markers } satisfies TrendSeries;
}

const squatLift = lift('Back squat', 11, 120, 0.22, 5);
/** The summary's "likely real" change, on the newest session. */
export const squat: TrendSeries = {
  ...squatLift,
  markers: [
    ...squatLift.markers,
    { date: squatLift.points.at(-1)!.date, kind: 'likely', label: '+4%, likely real' },
  ],
};
const bench = lift('Bench press', 12, 85, 0.2, 3);
const deadlift = lift('Deadlift', 13, 150, 0.18, 3);

/** Deloads (every sixth week) and the two breaks. */
export const annotations: readonly ChartAnnotation[] = (() => {
  const spans: ChartAnnotation[] = [];
  for (let week = 5; week * 7 < YEARS * 365; week += 6) {
    const from = startMs + week * 7 * DAY_MS;
    spans.push({ from: day(from), to: day(from + 6 * DAY_MS), label: 'Deload' });
  }
  for (const years of [1.4, 3.8]) {
    const from = startMs + years * 365 * DAY_MS;
    spans.push({ from: day(from), to: day(from + 21 * DAY_MS), label: 'Break' });
  }
  return spans;
})();

/** The three lifts as % change from their first trend value (ANL-02 comparison). */
export const comparison: readonly TrendSeries[] = [squatLift, bench, deadlift].map((series) => {
  const base = series.trend[0]?.value ?? 1;
  const percent = (value: number) => round(((value - base) / base) * 100, 0.1);
  return {
    name: series.name,
    points: series.points.map((point) => ({ ...point, value: percent(point.value) })),
    trend: series.trend.map((point) => ({ date: point.date, value: percent(point.value) })),
  };
});

/** 260 weeks of chest volume with a 10–20 target. */
export const volume: readonly VolumeWeek[] = (() => {
  const random = prng(21);
  const weeks: VolumeWeek[] = [];
  const firstMonday = startMs + ((8 - new Date(startMs).getUTCDay()) % 7) * DAY_MS;
  for (let at = firstMonday; at <= endMs; at += 7 * DAY_MS) {
    const roll = random();
    const sets = round(
      roll < 0.05
        ? 0
        : roll < 0.12
          ? 2 + random() * 1.5
          : roll > 0.96
            ? 31 + random() * 4
            : 6 + random() * 20,
      0.5,
    );
    const direct = round(sets * (0.55 + random() * 0.3), 1);
    weeks.push({ week: day(at), sets, direct, step: band(sets) });
  }
  return weeks;
})();

function band(sets: number): HeatStep {
  if (sets === 0) return 0;
  if (sets < 4) return 1;
  if (sets < 10) return 2;
  if (sets <= 20) return 3;
  if (sets <= 30) return 4;
  return 5;
}

export const volumeBands: readonly HeatBand[] = [
  { step: 0, label: 'None' },
  { step: 1, label: 'Below 4 sets' },
  { step: 2, label: 'Below target' },
  { step: 3, label: 'In target (10–20)' },
  { step: 4, label: 'High (20–30)' },
  { step: 5, label: 'Very high (over 30)' },
];

/** About 1,800 weigh-ins (most mornings) with an EMA trend (α 0.1). */
export const bodyweight = (() => {
  const random = prng(31);
  const entries: { date: string; value: number }[] = [];
  const trend: { date: string; value: number }[] = [];
  let ema = 0;
  for (let at = startMs; at <= endMs; at += DAY_MS) {
    if (random() < 0.02) continue;
    const years = (at - startMs) / (365 * DAY_MS);
    const value = round(78 + 6 * Math.sin(years * 1.3) + years * 0.6 + (random() - 0.5) * 1.8);
    ema = ema === 0 ? value : ema + 0.1 * (value - ema);
    entries.push({ date: day(at), value });
    trend.push({ date: day(at), value: round(ema, 0.01) });
  }
  return { entries, trend };
})();

/** November 2026 on the calendar: every status at least once. */
export const calendarDays: readonly CalendarDay[] = (() => {
  const plan: [number, CalendarStatus, string][] = [
    [2, 'completed', 'Upper A'],
    [3, 'completed', 'Lower A'],
    [5, 'partial', 'Upper B'],
    [6, 'missed', 'Lower B'],
    [9, 'deload', 'Upper A (lighter)'],
    [10, 'deload', 'Lower A (lighter)'],
    [12, 'break', 'Holiday'],
    [13, 'break', 'Holiday'],
    [16, 'completed', 'Upper A'],
    [17, 'completed', 'Lower A'],
    [19, 'completed', 'Upper B'],
    [23, 'planned', 'Upper A'],
    [24, 'planned', 'Lower A'],
    [26, 'planned', 'Upper B'],
    [27, 'planned', 'Lower B'],
  ];
  return plan.map(([date, status, label]) => ({
    date: `2026-11-${String(date).padStart(2, '0')}`,
    status,
    label,
  }));
})();
