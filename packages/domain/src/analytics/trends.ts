/**
 * Trends per exercise (ANL-02, PRG-02; technical concept §8.10 "data preparation"): the e1RM
 * series from `dSessionE1rm` (raw session points, the smoothed Kalman trend and its 95% band, for
 * the strength or the all-sets trend), the "likely real" and "very likely real" labels at each
 * session with the rep-range flag (never a change claimed inside the noise: the labels are the
 * PRG-02 thresholds of `labelChange`), PR markers, mesocycle, deload and break annotations, weekly
 * maxima for ranges over a year, up to three exercises normalised to % change, a one-sentence
 * summary's data, and the performance series (best set, volume load, reps at a load).
 */
import { estimateSetE1rm, type E1rmRules } from '../e1rm';
import type { Explained } from '../explain';
import type { ExerciseId, LocalDate, SessionId } from '../ids';
import type { ExerciseDef, LoggedSet, Plan, TrainingBreak } from '../model';
import type { RuleSlice, TraineeLevel } from '../rules';
import type { PointChange, PrRecord, PrType, SessionE1rmPoint, TrendBand } from '../session';
import { addDays, daysBetween, weekStartOf, type IsoWeekday } from '../time';
import {
  labelChange,
  pointFromBand,
  repRangeShift,
  type ChangeLabel,
  type ChangeRules,
  type NoLabelReason,
  type TrendPoint,
} from '../trend';
import { toKg } from '../units';

export type SeriesSource = 'strength' | 'all';
export const RANGE_PRESETS = ['4w', '12w', '6m', '1y', 'all'] as const;
export type RangePreset = (typeof RANGE_PRESETS)[number];

/** ANL-02 range presets: the first day of the range ending today (null: everything). */
export function rangeStart(preset: RangePreset, today: LocalDate): LocalDate | null {
  const days = { '4w': 28, '12w': 84, '6m': 182, '1y': 365, all: null }[preset];
  return days === null ? null : addDays(today, -days);
}

/** §8.10: ranges longer than this are shown as weekly maxima. */
export const WEEKLY_AGGREGATION_DAYS = 365;

export interface E1rmSeriesPoint {
  readonly sessionId: SessionId;
  readonly localDate: LocalDate;
  /** Raw session e1RM (all sets) and its weight: the scatter points. */
  readonly rawKg: number | null;
  readonly weight: number | null;
  /** The chosen trend after the session: the smoothed line and the 95% band. */
  readonly trend: TrendBand | null;
  /** PRG-02 label at this session ("likely real" marks); null without a trend point. */
  readonly change: PointChange | null;
  /** PR markers (MOT-01 types set in this session). */
  readonly prs: readonly PrType[];
}

export interface SeriesSummary {
  readonly fromDate: LocalDate | null;
  readonly toDate: LocalDate | null;
  readonly fromKg: number | null;
  readonly toKg: number | null;
  readonly deltaPct: number | null;
  readonly weeks: number;
  /** The latest label; `insufficientData` until enough points exist. */
  readonly label: ChangeLabel['label'];
  readonly direction: ChangeLabel['direction'];
  /** Why the latest change has no label (TD-62). */
  readonly reason?: NoLabelReason;
}

export interface E1rmSeries {
  readonly exerciseId: ExerciseId;
  readonly source: SeriesSource;
  readonly points: readonly E1rmSeriesPoint[];
  /** Weekly maxima instead of sessions (range over a year). */
  readonly aggregated: boolean;
  /** The current label with its "Why?" (PRG-09); null without a trend. */
  readonly latest: Explained<ChangeLabel> | null;
  readonly summary: SeriesSummary;
}

export type SeriesRules = ChangeRules & RuleSlice<'load.trend.repRangeShift'>;

export interface SeriesInput {
  readonly exerciseId: ExerciseId;
  /** Every stored point of the exercise (any order). */
  readonly points: readonly SessionE1rmPoint[];
  readonly prs: readonly PrRecord[];
  readonly source: SeriesSource;
  readonly from: LocalDate | null;
  readonly to: LocalDate;
  readonly level: TraineeLevel;
  readonly weekStartsOn: IsoWeekday;
  /** Median reps per session, for the rep-range flag of the all-sets trend. */
  readonly medianReps?: ReadonlyMap<SessionId, number | null>;
}

/** ANL-02: the e1RM series of one exercise for a source and a range. */
export function e1rmSeries(input: SeriesInput, rules: SeriesRules): E1rmSeries {
  const ordered = input.points.toSorted(
    (a, b) =>
      (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0) ||
      (a.sessionId < b.sessionId ? -1 : a.sessionId > b.sessionId ? 1 : 0),
  );
  const prsBySession = new Map<SessionId, PrType[]>();
  for (const pr of input.prs) {
    const types = prsBySession.get(pr.sessionId) ?? [];
    if (!types.includes(pr.type)) types.push(pr.type);
    prsBySession.set(pr.sessionId, types);
  }
  // The trend points of the chosen source, for labels at every session (whole history).
  const trendPoints: TrendPoint[] = [];
  const trendIndex = new Map<SessionId, number>();
  for (const point of ordered) {
    const band = input.source === 'strength' ? point.strength : point.all;
    if (!band) continue;
    trendIndex.set(point.sessionId, trendPoints.length);
    trendPoints.push(pointFromBand(point.localDate, band));
  }
  const samples = ordered.map((point) => ({
    localDate: point.localDate,
    medianReps: input.medianReps?.get(point.sessionId) ?? null,
  }));
  const changeOf = (point: SessionE1rmPoint, position: number): PointChange | null => {
    const index = trendIndex.get(point.sessionId);
    if (index === undefined) return null;
    if (input.source === 'strength' && point.change !== undefined) return point.change;
    const label = labelChange(trendPoints, input.level, rules, index).value;
    const real = label.label === 'likely' || label.label === 'veryLikely';
    return {
      label: label.label,
      direction: label.direction,
      deltaPct: label.deltaPct,
      referenceDate: label.referenceDate,
      repRange:
        real &&
        repRangeShift(samples.slice(0, position + 1), label.referenceDate, rules).value.shifted,
      ...(label.reason ? { reason: label.reason } : {}),
    };
  };
  const all: E1rmSeriesPoint[] = ordered.map((point, position) => ({
    sessionId: point.sessionId,
    localDate: point.localDate,
    rawKg: point.e1rmKg,
    weight: point.weight,
    trend: input.source === 'strength' ? point.strength : point.all,
    change: changeOf(point, position),
    prs: prsBySession.get(point.sessionId) ?? [],
  }));
  const inRange = all.filter(
    (point) =>
      (input.from === null || point.localDate >= input.from) && point.localDate <= input.to,
  );
  const first = inRange[0];
  const spanDays = first ? daysBetween(input.from ?? first.localDate, input.to) : 0;
  const aggregated = spanDays > WEEKLY_AGGREGATION_DAYS;
  const points = aggregated ? weeklyMaxima(inRange, input.weekStartsOn) : inRange;
  const latest = trendPoints.length > 0 ? labelChange(trendPoints, input.level, rules) : null;
  return {
    exerciseId: input.exerciseId,
    source: input.source,
    points,
    aggregated,
    latest,
    summary: seriesSummary(inRange),
  };
}

/** §8.10: one point per week: the highest raw e1RM, the week's last trend point and label. */
export function weeklyMaxima(
  points: readonly E1rmSeriesPoint[],
  weekStartsOn: IsoWeekday,
): E1rmSeriesPoint[] {
  const weeks = new Map<LocalDate, E1rmSeriesPoint[]>();
  for (const point of points) {
    const week = weekStartOf(point.localDate, weekStartsOn);
    weeks.set(week, [...(weeks.get(week) ?? []), point]);
  }
  return [...weeks.values()].map((entries) => {
    const last = entries.at(-1)!;
    const best = entries.reduce<E1rmSeriesPoint | null>(
      (top, entry) =>
        entry.rawKg !== null && (top === null || entry.rawKg > (top.rawKg ?? 0)) ? entry : top,
      null,
    );
    const withTrend = entries.findLast((entry) => entry.trend !== null);
    return {
      sessionId: (best ?? last).sessionId,
      localDate: last.localDate,
      rawKg: best?.rawKg ?? null,
      weight: best?.weight ?? null,
      trend: withTrend?.trend ?? null,
      change: withTrend?.change ?? null,
      prs: [...new Set(entries.flatMap((entry) => entry.prs))],
    };
  });
}

/** The data of the chart's one-sentence summary ("Squat e1RM rose 4% over 12 weeks", ANL-11). */
export function seriesSummary(points: readonly E1rmSeriesPoint[]): SeriesSummary {
  const withTrend = points.filter((point) => point.trend !== null);
  const first = withTrend[0];
  const last = withTrend.at(-1);
  const startKg = first?.trend?.e1rmKg ?? null;
  const endKg = last?.trend?.e1rmKg ?? null;
  return {
    fromDate: first?.localDate ?? null,
    toDate: last?.localDate ?? null,
    fromKg: startKg,
    toKg: endKg,
    deltaPct:
      startKg !== null && endKg !== null && startKg > 0 ? (endKg / startKg - 1) * 100 : null,
    weeks: first && last ? daysBetween(first.localDate, last.localDate) / 7 : 0,
    label: last?.change?.label ?? 'insufficientData',
    direction: last?.change?.direction ?? null,
    ...(last?.change?.reason ? { reason: last.change.reason } : {}),
  };
}

export interface ComparisonPoint {
  readonly localDate: LocalDate;
  /** % change of the smoothed e1RM against the series' first point in the range. */
  readonly pct: number;
}

/** ANL-02: up to three exercises on one chart, each normalised to % change. */
export function compareSeries(
  series: readonly E1rmSeries[],
): readonly { readonly exerciseId: ExerciseId; readonly points: readonly ComparisonPoint[] }[] {
  return series.slice(0, 3).map((entry) => {
    const base = entry.points.find((point) => point.trend !== null)?.trend?.e1rmKg ?? null;
    return {
      exerciseId: entry.exerciseId,
      points:
        base === null
          ? []
          : entry.points.flatMap((point) =>
              point.trend
                ? [{ localDate: point.localDate, pct: (point.trend.e1rmKg / base - 1) * 100 }]
                : [],
            ),
    };
  });
}

// --- Annotations ---------------------------------------------------------------------------

export interface ChartAnnotation {
  readonly kind: 'mesocycle' | 'deload' | 'break';
  readonly from: LocalDate;
  /** Inclusive; an open break ends at the range end. */
  readonly to: LocalDate;
  /** Mesocycle index (0-based) for mesocycles and their deloads. */
  readonly index: number | null;
}

/** ANL-02 annotations: mesocycles, deload weeks and breaks that overlap the range. */
export function chartAnnotations(
  plans: readonly Pick<Plan, 'mesocycles'>[],
  breaks: readonly Pick<TrainingBreak, 'startDate' | 'endDate'>[],
  from: LocalDate | null,
  to: LocalDate,
): ChartAnnotation[] {
  const overlaps = (start: LocalDate, end: LocalDate) =>
    start <= to && (from === null || end >= from);
  const annotations: ChartAnnotation[] = [];
  for (const plan of plans) {
    for (const mesocycle of plan.mesocycles) {
      const accumulationEnd = addDays(mesocycle.startDate, mesocycle.accumulationWeeks * 7 - 1);
      const end = addDays(accumulationEnd, mesocycle.deloadWeeks * 7);
      if (overlaps(mesocycle.startDate, end)) {
        annotations.push({
          kind: 'mesocycle',
          from: mesocycle.startDate,
          to: end,
          index: mesocycle.index,
        });
      }
      if (mesocycle.deloadWeeks > 0 && !mesocycle.deload.skipped) {
        const deloadFrom = addDays(accumulationEnd, 1);
        if (overlaps(deloadFrom, end)) {
          annotations.push({ kind: 'deload', from: deloadFrom, to: end, index: mesocycle.index });
        }
      }
    }
  }
  for (const entry of breaks) {
    const end = entry.endDate ?? to;
    if (overlaps(entry.startDate, end)) {
      annotations.push({ kind: 'break', from: entry.startDate, to: end, index: null });
    }
  }
  return annotations.toSorted(
    (a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0) || a.kind.localeCompare(b.kind),
  );
}

// --- Performance series (ANL-02 "performance") --------------------------------------------

export interface ExposureSets {
  readonly sessionId: SessionId;
  readonly localDate: LocalDate;
  /** The exercise's sets of the session. */
  readonly sets: readonly LoggedSet[];
}

export interface PerformancePoint {
  readonly sessionId: SessionId;
  readonly localDate: LocalDate;
  /** The set with the highest e1RM (else the heaviest): load, reps, RIR. */
  readonly bestSet: {
    readonly loadKg: number;
    readonly reps: number;
    readonly rir: number | null;
    readonly e1rmKg: number | null;
  } | null;
  /** Σ external load × reps of the working sets (ANL-09: never compared across exercises). */
  readonly volumeKg: number;
  readonly topLoadKg: number | null;
  readonly workingSets: number;
}

/** Per session: best set, volume load, top load (ANL-02 performance series). */
export function performanceSeries(
  exposures: readonly ExposureSets[],
  exercise: Pick<ExerciseDef, 'load'>,
  rules: E1rmRules,
  bodyweightAt: (date: LocalDate) => number | null = () => null,
): PerformancePoint[] {
  return exposures
    .toSorted((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0))
    .map((exposure) => {
      const working = exposure.sets.filter(
        (set) =>
          set.state === 'done' &&
          set.type !== 'warmup' &&
          set.type !== 'timed' &&
          set.reps !== null,
      );
      let best: PerformancePoint['bestSet'] = null;
      let volumeKg = 0;
      let topLoadKg: number | null = null;
      for (const set of working) {
        const loadKg = set.load ? toKg(set.load) : 0;
        const reps = set.reps ?? 0;
        if (loadKg > 0) volumeKg += loadKg * reps;
        if (set.load) topLoadKg = Math.max(topLoadKg ?? loadKg, loadKg);
        const estimate = estimateSetE1rm(
          set,
          exercise.load,
          { setOrder: 0, bodyweightKg: bodyweightAt(exposure.localDate) },
          rules,
        ).value;
        const rir = set.effort.source === 'entered' ? set.effort.rir : null;
        const candidate = { loadKg, reps, rir, e1rmKg: estimate?.e1rmKg ?? null };
        if (
          best === null ||
          (candidate.e1rmKg ?? -1) > (best.e1rmKg ?? -1) ||
          (candidate.e1rmKg === best.e1rmKg &&
            candidate.loadKg * candidate.reps > best.loadKg * best.reps)
        ) {
          best = candidate;
        }
      }
      return {
        sessionId: exposure.sessionId,
        localDate: exposure.localDate,
        bestSet: best,
        volumeKg,
        topLoadKg,
        workingSets: working.length,
      };
    });
}

export interface RepsAtLoadPoint {
  readonly sessionId: SessionId;
  readonly localDate: LocalDate;
  /** Most reps in one working set at the load or heavier. */
  readonly reps: number;
}

/** ANL-02 "reps at load": the most reps per session at `loadKg` or more (sessions without one left out). */
export function repsAtLoad(exposures: readonly ExposureSets[], loadKg: number): RepsAtLoadPoint[] {
  return exposures
    .toSorted((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0))
    .flatMap((exposure) => {
      let reps: number | null = null;
      for (const set of exposure.sets) {
        if (set.state !== 'done' || set.type === 'warmup' || set.reps === null || !set.load)
          continue;
        if (toKg(set.load) + 1e-6 >= loadKg) reps = Math.max(reps ?? 0, set.reps);
      }
      return reps === null
        ? []
        : [{ sessionId: exposure.sessionId, localDate: exposure.localDate, reps }];
    });
}

/** The loads used most often (kg, most frequent first): choices for the "reps at load" series. */
export function commonLoads(exposures: readonly ExposureSets[], limit = 5): number[] {
  const counts = new Map<number, number>();
  for (const exposure of exposures) {
    for (const set of exposure.sets) {
      if (set.state !== 'done' || set.type === 'warmup' || !set.load) continue;
      const kg = Math.round(toKg(set.load) * 100) / 100;
      if (kg > 0) counts.set(kg, (counts.get(kg) ?? 0) + 1);
    }
  }
  return [...counts]
    .toSorted(([loadA, a], [loadB, b]) => b - a || loadB - loadA)
    .slice(0, limit)
    .map(([load]) => load);
}
