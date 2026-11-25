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

/**
 * BOD-01: several readings on one day are allowed; the trend uses each day's first (morning)
 * reading by default. Returns the first reading of every day, by measurement time.
 */
export function firstReadingPerDay<
  T extends { readonly localDate: LocalDate; readonly measuredAt: { readonly epochMs: number } },
>(entries: readonly T[]): T[] {
  const first = new Map<LocalDate, T>();
  for (const entry of entries) {
    const known = first.get(entry.localDate);
    if (!known || entry.measuredAt.epochMs < known.measuredAt.epochMs) {
      first.set(entry.localDate, entry);
    }
  }
  return [...first.values()].toSorted((a, b) =>
    a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0,
  );
}

export type RateRules = RuleSlice<
  'bodyweight.rate.bulk' | 'bodyweight.rate.cut' | 'bodyweight.rate.maintain'
>;

export type RatePhase = 'bulk' | 'cut' | 'maintain' | 'notTracking';

export interface RateBand {
  readonly phase: RatePhase;
  /** Against the phase's band; `untracked` when no phase is set. */
  readonly status: 'below' | 'in' | 'above' | 'untracked' | 'insufficientData';
  /** The band in signed % of bodyweight per week (gain positive, loss negative). */
  readonly band: { readonly min: number; readonly max: number } | null;
  /**
   * EB guards, never from a single day (BOD-02): `fastLoss` above the cut's hard limit for its
   * sustained weeks; `fastGain` above the bulk band for its sustained weeks.
   */
  readonly warning: 'none' | 'fastLoss' | 'fastGain';
  readonly pctPerWeek: number | null;
}

/**
 * BOD-02: the weekly rate against the phase's band (EB §Nutrition › Bulking, › Cutting): bulk by
 * level (novice and intermediate 0.25–0.5 %, advanced 0.1–0.25 % per week), cut 0.5–0.7 % loss
 * per week, maintenance within ±0.25 % ([INF]). `history` holds the weekly rates, newest first
 * (the rate now, a week earlier, …), for the sustained-rate warnings.
 */
export function rateBand(
  history: readonly (number | null)[],
  phase: RatePhase,
  level: 'novice' | 'intermediate' | 'advanced',
  rules: RateRules,
): Explained<RateBand> {
  const bulk = rules['bodyweight.rate.bulk'];
  const cut = rules['bodyweight.rate.cut'];
  const maintain = rules['bodyweight.rate.maintain'];
  const params =
    phase === 'bulk' ? [bulk] : phase === 'cut' ? [cut] : phase === 'maintain' ? [maintain] : [];
  const pct = history[0] ?? null;
  const band =
    phase === 'bulk'
      ? { min: bulk.value.target[level].min, max: bulk.value.target[level].max }
      : phase === 'cut'
        ? { min: -cut.value.target.max, max: -cut.value.target.min }
        : phase === 'maintain'
          ? { min: maintain.value.min, max: maintain.value.max }
          : null;
  const sustained = (weeks: number, beyond: (rate: number) => boolean) =>
    history.length >= weeks &&
    history.slice(0, weeks).every((rate) => rate !== null && beyond(rate));
  const warning: RateBand['warning'] =
    phase === 'cut' &&
    sustained(cut.value.sustainedWeeks, (rate) => -rate > cut.value.hardWarnAbove)
      ? 'fastLoss'
      : phase === 'bulk' &&
          sustained(bulk.value.sustainedWeeks, (rate) => rate > bulk.value.target[level].max)
        ? 'fastGain'
        : 'none';
  const status: RateBand['status'] =
    band === null
      ? 'untracked'
      : pct === null
        ? 'insufficientData'
        : pct < band.min - 1e-9
          ? 'below'
          : pct > band.max + 1e-9
            ? 'above'
            : 'in';
  const value: RateBand = { phase, status, band, warning, pctPerWeek: pct };
  return explained(value, 'bodyweight.rate.band', {
    args: {
      phase,
      status,
      level,
      pctPerWeek: pct,
      min: band?.min ?? null,
      max: band?.max ?? null,
      warning,
    },
    params,
  });
}

// --- Body measurements (BOD-03) ------------------------------------------------------------

export interface MeasurementPoint {
  readonly id: string;
  readonly localDate: LocalDate;
  /** In the series' unit (the latest entry's unit; cm and in convert, mm stays mm). */
  readonly value: number;
}

export interface MeasurementSeries<S extends string = string> {
  readonly site: S;
  readonly unit: 'cm' | 'in' | 'mm';
  /** Each day's first measurement, oldest first. */
  readonly points: readonly MeasurementPoint[];
  readonly latest: MeasurementPoint | null;
  /** Change since the first point, and against the last point at least 28 days earlier. */
  readonly sinceFirst: number | null;
  readonly fourWeeks: number | null;
}

/** BOD-03: the trend of one site (raw values; measurements are too sparse to smooth). */
export function measurementSeries<S extends string>(
  site: S,
  entries: readonly {
    readonly id: string;
    readonly site: string;
    readonly localDate: LocalDate;
    readonly measuredAt: { readonly epochMs: number };
    readonly value: number;
    readonly unit: 'cm' | 'in' | 'mm';
  }[],
): MeasurementSeries<S> {
  const daily = firstReadingPerDay(entries.filter((entry) => entry.site === site));
  const unit = daily.at(-1)?.unit ?? 'cm';
  const convert = (value: number, from: 'cm' | 'in' | 'mm'): number =>
    from === unit || from === 'mm' || unit === 'mm'
      ? value
      : from === 'cm'
        ? value / 2.54
        : value * 2.54;
  const points = daily.map((entry) => ({
    id: entry.id,
    localDate: entry.localDate,
    value: convert(entry.value, entry.unit),
  }));
  const latest = points.at(-1) ?? null;
  const first = points[0] ?? null;
  const reference = latest
    ? points.findLast(
        (point) => point !== latest && daysBetween(point.localDate, latest.localDate) >= 28,
      )
    : undefined;
  return {
    site,
    unit,
    points,
    latest,
    sinceFirst: latest && first && first !== latest ? latest.value - first.value : null,
    fourWeeks: latest && reference ? latest.value - reference.value : null,
  };
}
