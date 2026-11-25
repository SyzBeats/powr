import type { CompetitionLift, ExerciseId, LocalDate } from '@powr/domain';
import {
  scoreBoard,
  type DatedTotal,
  type ScoreBoard,
  type ScoreSource,
} from '@powr/domain/analytics';
import { currentE1rm, repMax, type PrRecord, type SessionE1rmPoint } from '@powr/domain/session';

import type { Deps } from '../deps';
import { ensureDerived } from '../session/derived';
import { insightsContext } from './context';

/*
 * ANL-07: the powerlifting scores for the competition-lift total and each lift, from the current
 * e1RMs (default) or the best tested loads (the heaviest load lifted for at least one rep), with
 * the bodyweight trend on the day; current and best, with the points history. Each formula names
 * its version and the registry rows (sources, `verified`) behind its coefficients; the rules
 * version is `rulesVersion`. No sex reference (ONB-02 skipped) or no bodyweight: `missing` says
 * what to ask for.
 */

export interface ScoreBoardView extends ScoreBoard {
  readonly rulesVersion: string;
}

const LIFTS: readonly CompetitionLift[] = ['squat', 'bench', 'deadlift'];

export async function scores(
  deps: Deps,
  input: { readonly source?: ScoreSource; readonly division?: 'classic' | 'equipped' } = {},
): Promise<ScoreBoardView> {
  const ctx = await insightsContext(deps);
  const competition = deps.content
    .exercises()
    .filter((exercise) => exercise.competitionLift !== undefined && exercise.status === 'active');
  const ids = competition.map((exercise) => exercise.id);
  await ensureDerived(deps, ctx.prepared, ids);
  const loaded = await deps.uow.read(
    ['dExerciseState', 'dSessionE1rm', 'dPrs', 'meets'],
    async (repos) => ({
      states: await repos.derived.exerciseStates(ids),
      points: (await Promise.all(ids.map((id) => repos.derived.pointsByExercise(id)))).flat(),
      prs: (await Promise.all(ids.map((id) => repos.derived.prsByExercise(id)))).flat(),
      meets: await repos.meets.list(),
    }),
  );
  const source = input.source ?? ctx.preferences.scoreSource;
  const division =
    input.division ??
    ctx.preferences.division ??
    loaded.meets.findLast((meet) => meet.division !== null)?.division ??
    'classic';
  const liftOf = (id: ExerciseId) => deps.content.exercise(id)?.competitionLift;

  const lifts = LIFTS.map((lift) => {
    let best: { exerciseId: ExerciseId; kg: number } | null = null;
    for (const state of loaded.states) {
      if (liftOf(state.exerciseId) !== lift) continue;
      const kg = source === 'e1rm' ? currentE1rm(state) : repMax(state.bests.reps, 1);
      if (kg !== null && (best === null || kg > best.kg))
        best = { exerciseId: state.exerciseId, kg };
    }
    return { lift, exerciseId: best?.exerciseId ?? null, kg: best?.kg ?? null };
  });

  const history =
    source === 'e1rm'
      ? historyFromPoints(loaded.points, liftOf, ctx.prepared.bodyweightAt)
      : historyFromPrs(loaded.prs, liftOf, ctx.prepared.bodyweightAt);

  return {
    ...scoreBoard(
      {
        sex: ctx.prepared.profile?.referenceSet ?? null,
        division,
        source,
        bodyweightKg: ctx.prepared.bodyweightAt(ctx.today),
        lifts,
        history,
      },
      ctx.prepared.rules(null),
    ),
    rulesVersion: deps.rules.version,
  };
}

type LiftOf = (id: ExerciseId) => CompetitionLift | undefined;

/** Totals over time from the smoothed strength e1RMs: at each session, each lift's latest value. */
function historyFromPoints(
  points: readonly SessionE1rmPoint[],
  liftOf: LiftOf,
  bodyweightAt: (date: LocalDate) => number | null,
): DatedTotal[] {
  const latest = new Map<ExerciseId, number>();
  const events = points
    .filter((point) => (point.strength ?? point.all) !== null)
    .toSorted((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0));
  return datedTotals(
    events.map((point) => ({
      localDate: point.localDate,
      apply: () => latest.set(point.exerciseId, (point.strength ?? point.all)!.e1rmKg),
    })),
    () => liftValues(latest, liftOf),
    bodyweightAt,
  );
}

/** Totals over time from the tested loads: each lift's heaviest load so far (load PRs). */
function historyFromPrs(
  prs: readonly PrRecord[],
  liftOf: LiftOf,
  bodyweightAt: (date: LocalDate) => number | null,
): DatedTotal[] {
  const best = new Map<ExerciseId, number>();
  const events = prs
    .filter((pr) => pr.type === 'load')
    .toSorted((a, b) => (a.localDate < b.localDate ? -1 : a.localDate > b.localDate ? 1 : 0));
  return datedTotals(
    events.map((pr) => ({
      localDate: pr.localDate,
      apply: () => best.set(pr.exerciseId, Math.max(best.get(pr.exerciseId) ?? 0, pr.valueKg)),
    })),
    () => liftValues(best, liftOf),
    bodyweightAt,
  );
}

function liftValues(
  values: ReadonlyMap<ExerciseId, number>,
  liftOf: LiftOf,
): Record<CompetitionLift, number | null> {
  const lifts: Record<CompetitionLift, number | null> = {
    squat: null,
    bench: null,
    deadlift: null,
  };
  for (const [id, kg] of values) {
    const lift = liftOf(id);
    if (lift !== undefined && (lifts[lift] === null || kg > (lifts[lift] ?? 0))) lifts[lift] = kg;
  }
  return lifts;
}

/** One dated total per day with events (after all of that day's events), with the day's bodyweight. */
function datedTotals(
  events: readonly { readonly localDate: LocalDate; readonly apply: () => void }[],
  snapshot: () => Record<CompetitionLift, number | null>,
  bodyweightAt: (date: LocalDate) => number | null,
): DatedTotal[] {
  const totals: DatedTotal[] = [];
  events.forEach((event, index) => {
    event.apply();
    if (events[index + 1]?.localDate === event.localDate) return;
    const bodyweightKg = bodyweightAt(event.localDate);
    if (bodyweightKg !== null)
      totals.push({ localDate: event.localDate, bodyweightKg, lifts: snapshot() });
  });
  return totals;
}
