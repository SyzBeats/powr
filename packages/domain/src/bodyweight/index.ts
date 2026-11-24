/**
 * `@powr/domain/bodyweight`: the bodyweight trend and weekly rate (BOD-02; EB §Nutrition › Trend
 * smoothing). A daily EMA (α 0.1) with gaps handled by α_eff = 1 − (1 − α)^Δdays, started from
 * the mean of the first 3–7 weigh-ins and fed readings winsorised to ±2.5% of the trend; the rate
 * is the least-squares slope over the last 14–28 days. Several readings on one day are averaged.
 */
import { explained, quantity, type Explained } from '../explain';
import type { LocalDate } from '../ids';
import type { RuleSlice } from '../rules';
import { daysBetween } from '../time';
import { toKg, type Mass } from '../units';

export type BodyweightRules = RuleSlice<
  | 'bodyweight.trend.alphaPerDay'
  | 'bodyweight.trend.initialWeighIns'
  | 'bodyweight.trend.winsorizePct'
>;

export interface WeighIn {
  readonly localDate: LocalDate;
  readonly mass: Mass;
}

export interface BodyweightPoint {
  readonly localDate: LocalDate;
  /** The day's reading (mean of that day's readings). */
  readonly rawKg: number;
  /** The reading the trend used, after winsorising. */
  readonly usedKg: number;
  readonly winsorized: boolean;
  /** Null until the first weigh-ins have initialised the trend. */
  readonly trendKg: number | null;
}

export function bodyweightTrend(
  weighIns: readonly WeighIn[],
  rules: BodyweightRules,
): Explained<readonly BodyweightPoint[]> {
  const alpha = rules['bodyweight.trend.alphaPerDay'].value;
  const init = rules['bodyweight.trend.initialWeighIns'].value;
  const band = rules['bodyweight.trend.winsorizePct'].value / 100;
  const days = dailyMeans(weighIns);

  const points: BodyweightPoint[] = [];
  let trend = 0;
  let sum = 0;
  let previous: LocalDate | null = null;
  let winsorizedCount = 0;
  days.forEach(({ localDate, kg }, index) => {
    if (index < init.max) {
      // Initialisation: the running mean of the first weigh-ins.
      sum += kg;
      trend = sum / (index + 1);
      points.push({
        localDate,
        rawKg: kg,
        usedKg: kg,
        winsorized: false,
        trendKg: index + 1 >= init.min ? trend : null,
      });
    } else {
      const used = Math.min(trend * (1 + band), Math.max(trend * (1 - band), kg));
      const gap = previous === null ? 1 : Math.max(0, daysBetween(previous, localDate));
      trend += (1 - (1 - alpha) ** gap) * (used - trend);
      if (used !== kg) winsorizedCount++;
      points.push({ localDate, rawKg: kg, usedKg: used, winsorized: used !== kg, trendKg: trend });
    }
    previous = localDate;
  });

  return explained<readonly BodyweightPoint[]>(points, 'bodyweight.trend', {
    args: { trend: points.at(-1)?.trendKg ?? null, days: points.length },
    facts: [quantity('winsorized', winsorizedCount)],
    params: [
      rules['bodyweight.trend.alphaPerDay'],
      rules['bodyweight.trend.initialWeighIns'],
      rules['bodyweight.trend.winsorizePct'],
    ],
  });
}

export interface BodyweightRate {
  readonly kgPerWeek: number;
  /** Relative to the latest trend value. */
  readonly pctPerWeek: number;
  readonly spanDays: number;
  readonly readings: number;
}

/**
 * Weekly rate: the regression slope of the (winsorised) readings within the window ending at the
 * latest reading; null until they span at least the window's minimum.
 */
export function bodyweightRate(
  points: readonly BodyweightPoint[],
  rules: RuleSlice<'bodyweight.rate.windowDays'>,
): Explained<BodyweightRate | null> {
  const window = rules['bodyweight.rate.windowDays'];
  const last = points.at(-1);
  const recent = last
    ? points.filter((point) => daysBetween(point.localDate, last.localDate) < window.value.max)
    : [];
  const first = recent[0];
  const spanDays = first && last ? daysBetween(first.localDate, last.localDate) : 0;
  if (!first || !last || recent.length < 2 || spanDays < window.value.min) {
    return explained(null, 'bodyweight.rate.insufficientData', {
      args: { spanDays, readings: recent.length },
      params: [window],
    });
  }

  const xs = recent.map((point) => daysBetween(first.localDate, point.localDate));
  const ys = recent.map((point) => point.usedKg);
  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let sxy = 0;
  let sxx = 0;
  xs.forEach((x, i) => {
    sxy += (x - meanX) * ((ys[i] ?? meanY) - meanY);
    sxx += (x - meanX) ** 2;
  });
  const kgPerWeek = (sxy / sxx) * 7;
  const reference = last.trendKg ?? last.usedKg;
  const value: BodyweightRate = {
    kgPerWeek,
    pctPerWeek: (kgPerWeek / reference) * 100,
    spanDays,
    readings: recent.length,
  };
  return explained(value, 'bodyweight.rate', {
    args: { kgPerWeek, pctPerWeek: value.pctPerWeek, spanDays },
    params: [window],
  });
}

function dailyMeans(weighIns: readonly WeighIn[]): { localDate: LocalDate; kg: number }[] {
  const byDay = new Map<LocalDate, { sum: number; count: number }>();
  for (const { localDate, mass } of weighIns) {
    const day = byDay.get(localDate) ?? { sum: 0, count: 0 };
    day.sum += toKg(mass);
    day.count++;
    byDay.set(localDate, day);
  }
  return [...byDay]
    .toSorted(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([localDate, { sum, count }]) => ({ localDate, kg: sum / count }));
}
