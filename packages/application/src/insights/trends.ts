import { type ExerciseId, type LocalDate, type LoggedSet, type SessionId } from '@powr/domain';
import {
  chartAnnotations,
  commonLoads,
  compareSeries,
  e1rmSeries,
  performanceSeries,
  rangeStart,
  repsAtLoad,
  type ChartAnnotation,
  type ComparisonPoint,
  type E1rmSeries,
  type ExposureSets,
  type PerformancePoint,
  type RangePreset,
  type RepsAtLoadPoint,
  type SeriesSource,
} from '@powr/domain/analytics';
import type { Explained } from '@powr/domain/explain';
import { bodyRegionOf, progressionPace, type PaceCheck } from '@powr/domain/progression';
import { exposuresOf, sortSets, type ExerciseState } from '@powr/domain/session';
import { median } from '@powr/domain/trend';

import type { Deps } from '../deps';
import { ensureDerived } from '../session/derived';
import { insightsContext, type InsightsContext } from './context';

/*
 * Trends per exercise (ANL-02, PRG-02; TD-44): the e1RM chart's data from `dSessionE1rm` (raw
 * points, the smoothed trend and its 95% band for the strength or the all-sets trend, the "likely
 * real" labels with their rep-range flag, PR markers, mesocycle/deload/break annotations, weekly
 * maxima beyond a year, the one-sentence summary), up to three exercises as % change, the
 * performance series (best set, volume load, reps at a load) and the PRG-07 pace check.
 */

export interface ExerciseTrendView {
  readonly series: E1rmSeries;
  readonly annotations: readonly ChartAnnotation[];
  /** PRG-07 (TD-44): whether planned linear increases outrun the observed trend, with "Why?". */
  readonly pace: Explained<PaceCheck> | null;
  readonly range: { readonly from: LocalDate | null; readonly to: LocalDate };
}

export interface TrendQuery {
  readonly exerciseId: ExerciseId;
  readonly range?: RangePreset;
  readonly source?: SeriesSource;
}

type LoadedExercise = Awaited<ReturnType<typeof readExercise>>;

/** Loads still running, per container and exercise (M6a). */
const running = new WeakMap<Deps, Map<ExerciseId, Promise<ExerciseData>>>();

interface ExerciseData {
  readonly ctx: InsightsContext;
  readonly loaded: LoadedExercise;
}

/**
 * The context and one exercise's records for the single-exercise views. The exercise screens
 * open its history, trend and performance at the same moment (M6a: three full reads of five years
 * of sets before); callers that start in the same task while a load for the exercise is still
 * running share it. No write can commit inside that task, so a shared load is exactly what each
 * caller would have read; a finished load, or one from an earlier task, is never reused.
 */
function exerciseData(deps: Deps, exerciseId: ExerciseId): Promise<ExerciseData> {
  let loads = running.get(deps);
  if (!loads) {
    loads = new Map();
    running.set(deps, loads);
  }
  const known = loads.get(exerciseId);
  if (known) return known;
  const load = (async () => {
    const ctx = await insightsContext(deps);
    return { ctx, loaded: await readExercise(deps, ctx, exerciseId) };
  })();
  const table = loads;
  const forget = () => {
    if (table.get(exerciseId) === load) table.delete(exerciseId);
  };
  table.set(exerciseId, load);
  setTimeout(forget, 0);
  load.then(forget, forget);
  return load;
}

async function readExercise(deps: Deps, ctx: InsightsContext, exerciseId: ExerciseId) {
  await ensureDerived(deps, ctx.prepared, [exerciseId]);
  return deps.uow.read(
    ['dExerciseState', 'dSessionE1rm', 'dPrs', 'sets', 'sessions', 'plans', 'breaks'],
    async (repos) => {
      const sets = await repos.sets.byExercise(exerciseId);
      const sessionIds = [...new Set(sets.map((set) => set.sessionId))];
      return {
        state: (await repos.derived.exerciseStates([exerciseId]))[0] ?? null,
        points: await repos.derived.pointsByExercise(exerciseId),
        prs: await repos.derived.prsByExercise(exerciseId),
        sets,
        sessions: await repos.sessions.byIds(sessionIds),
        plans: await repos.plans.list(),
        breaks: await repos.breaks.list(),
      };
    },
  );
}

/** The exercise's exposures (finished and partial sessions, in date order). */
function exposures(
  sets: readonly LoggedSet[],
  sessions: LoadedExercise['sessions'],
): ExposureSets[] {
  const counted = sessions
    .filter((session) => session.status === 'finished' || session.status === 'partial')
    .toSorted(
      (a, b) =>
        (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0) ||
        a.startedAt.epochMs - b.startedAt.epochMs,
    );
  return exposuresOf(
    sets,
    counted.map((session) => ({ id: session.id, localDate: session.localDate })),
  ).map((exposure) => ({
    sessionId: exposure.sessionId,
    localDate: exposure.localDate,
    sets: exposure.sets,
  }));
}

function medianRepsBySession(list: readonly ExposureSets[]): Map<SessionId, number | null> {
  return new Map(
    list.map((exposure) => [
      exposure.sessionId,
      median(
        exposure.sets.flatMap((set) =>
          set.state === 'done' && set.type !== 'warmup' && set.reps !== null ? [set.reps] : [],
        ),
      ),
    ]),
  );
}

/** ANL-02: one exercise's e1RM chart data for a range and source. */
export async function exerciseTrend(deps: Deps, query: TrendQuery): Promise<ExerciseTrendView> {
  const { ctx, loaded } = await exerciseData(deps, query.exerciseId);
  const from = rangeStart(query.range ?? '12w', ctx.today);
  const list = exposures(loaded.sets, loaded.sessions);
  const rules = ctx.prepared.rules(query.exerciseId);
  const series = e1rmSeries(
    {
      exerciseId: query.exerciseId,
      points: loaded.points,
      prs: loaded.prs,
      source: query.source ?? 'strength',
      from,
      to: ctx.today,
      level: ctx.prepared.level,
      weekStartsOn: ctx.weekStartsOn,
      medianReps: medianRepsBySession(list),
    },
    rules,
  );
  return {
    series,
    annotations: chartAnnotations(loaded.plans, loaded.breaks, from, ctx.today),
    pace: paceOf(deps, ctx, query.exerciseId, loaded.state),
    range: { from, to: ctx.today },
  };
}

function paceOf(
  deps: Deps,
  ctx: InsightsContext,
  exerciseId: ExerciseId,
  state: ExerciseState | null,
): Explained<PaceCheck> | null {
  const exercise = deps.content.exercise(exerciseId);
  const recent = state?.recent ?? [];
  const loadKg = recent.findLast((entry) => entry.topLoadKg !== null)?.topLoadKg ?? null;
  if (!exercise || loadKg === null) return null;
  return progressionPace(
    {
      samples: recent,
      today: ctx.today,
      level: ctx.prepared.level,
      region: bodyRegionOf(exercise.pattern),
      loadKg,
    },
    ctx.prepared.rules(exerciseId),
  );
}

/** ANL-02: up to three exercises on one chart, normalised to % change from the range's start. */
export async function compareTrends(
  deps: Deps,
  query: {
    readonly exerciseIds: readonly ExerciseId[];
    readonly range?: RangePreset;
    readonly source?: SeriesSource;
  },
): Promise<
  readonly { readonly exerciseId: ExerciseId; readonly points: readonly ComparisonPoint[] }[]
> {
  const views = [];
  for (const exerciseId of query.exerciseIds.slice(0, 3)) {
    views.push(
      (
        await exerciseTrend(deps, {
          exerciseId,
          ...(query.range ? { range: query.range } : {}),
          ...(query.source ? { source: query.source } : {}),
        })
      ).series,
    );
  }
  return compareSeries(views);
}

export interface PerformanceView {
  readonly points: readonly PerformancePoint[];
  /** The loads used most often (kg), choices for `repsAtLoad`. */
  readonly loads: readonly number[];
  readonly repsAtLoad: {
    readonly loadKg: number;
    readonly points: readonly RepsAtLoadPoint[];
  } | null;
}

/** ANL-02 performance series: best set, volume load per session and reps at a load. */
export async function exercisePerformance(
  deps: Deps,
  query: {
    readonly exerciseId: ExerciseId;
    readonly range?: RangePreset;
    readonly loadKg?: number;
  },
): Promise<PerformanceView> {
  const { ctx, loaded } = await exerciseData(deps, query.exerciseId);
  const from = rangeStart(query.range ?? '12w', ctx.today);
  const list = exposures(loaded.sets, loaded.sessions).filter(
    (exposure) => from === null || exposure.localDate >= from,
  );
  const exercise = deps.content.exercise(query.exerciseId);
  const loads = commonLoads(list);
  const loadKg = query.loadKg ?? loads[0] ?? null;
  return {
    points: exercise
      ? performanceSeries(
          list,
          exercise,
          ctx.prepared.rules(query.exerciseId),
          ctx.prepared.bodyweightAt,
        )
      : [],
    loads,
    repsAtLoad: loadKg === null ? null : { loadKg, points: repsAtLoad(list, loadKg) },
  };
}

export interface ProgressionAdvice {
  readonly exerciseId: ExerciseId;
  readonly dayKey: string;
  readonly slotKey: string;
  readonly pace: Explained<PaceCheck>;
}

/**
 * PRG-07 (TD-44): the linear-progression slots of the current mesocycle whose planned increases
 * outrun the observed e1RM trend. The session engine already loads them from the e1RM (or adds
 * reps first); the plan editor can switch the slot's progression for good.
 */
export async function progressionAdvice(deps: Deps): Promise<readonly ProgressionAdvice[]> {
  const ctx = await insightsContext(deps);
  const plan = ctx.prepared.plan;
  const mesocycle =
    plan?.mesocycles.find((entry) => entry.status === 'active') ?? plan?.mesocycles.at(-1);
  if (!mesocycle) return [];
  const slots = mesocycle.days.flatMap((day) =>
    day.slots
      .filter((slot) => slot.progression === 'linear')
      .map((slot) => ({ dayKey: day.key, slot })),
  );
  const ids = [...new Set(slots.map((entry) => entry.slot.exerciseId))];
  await ensureDerived(deps, ctx.prepared, ids);
  const states = await deps.uow.read(['dExerciseState'], (repos) =>
    repos.derived.exerciseStates(ids),
  );
  return slots.flatMap(({ dayKey, slot }) => {
    const pace = paceOf(
      deps,
      ctx,
      slot.exerciseId,
      states.find((state) => state.exerciseId === slot.exerciseId) ?? null,
    );
    return pace?.value.outrun
      ? [{ exerciseId: slot.exerciseId, dayKey, slotKey: slot.key, pace }]
      : [];
  });
}

/** The sets of one exercise grouped per session, newest first (ANL-04 "all sessions"). */
export function sessionsOf(
  sets: readonly LoggedSet[],
  sessions: LoadedExercise['sessions'],
): ExposureSets[] {
  return exposures(sets, sessions)
    .map((exposure) => ({ ...exposure, sets: sortSets(exposure.sets) }))
    .toReversed();
}

export { exerciseData };
