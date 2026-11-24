import {
  COMPETITION_LIFTS,
  SET_LIMITS,
  toKg,
  type Baseline,
  type CompetitionLift,
  type ExerciseDef,
  type ExerciseId,
  type LoadType,
  type TrainingStyle,
} from '@powr/domain';
import { baselineE1rm, calibrationFallback, type BaselineE1rm } from '@powr/domain/e1rm';
import type { Explained, Explanation } from '@powr/domain/explain';

import type { Deps } from '../deps';
import { exerciseRules, today, type PlanningAnswers } from './context';
import { generatePlanPreview } from './plan';

/*
 * ONB-08: the optional baselines step. It asks for the main lifts of the plan the answers give,
 * shows the starting e1RM each entry gives (the e1RM engine, `baselineE1rm`), and what happens
 * without one (the calibration fallback, PRG-08). The entries are stored as they were given, in
 * `Profile.baselines` (`completeOnboarding`); M3's session engine derives the starting e1RM of
 * an exercise without logged sets from them with `baselineE1rm`.
 */

/** Competition lifts first, in the order squat, bench press, deadlift (ONB-08 "main lifts"). */
function liftRank(lift: CompetitionLift | undefined): number {
  return lift === undefined ? COMPETITION_LIFTS.length : COMPETITION_LIFTS.indexOf(lift);
}

/** At most this many lifts are asked for, so the optional step stays short (NFR-USE-02). */
const MAX_BASELINE_LIFTS = 4;

/** Load types the e1RM engine estimates without a bodyweight entry (bars, dumbbells, machines). */
const LOADED: ReadonlySet<LoadType> = new Set<LoadType>(['barbell', 'dumbbell', 'machine']);

export interface BaselineLift {
  readonly exerciseId: ExerciseId;
  /** The competition lift it is, for strength styles (squat, bench press, deadlift). */
  readonly lift: CompetitionLift | null;
}

export interface BaselineLifts {
  readonly lifts: readonly BaselineLift[];
  /** What the first sessions do for an exercise without a baseline (PRG-08). */
  readonly fallback: Explanation;
}

/**
 * The main lifts to ask about (ONB-08 "the main lifts of the chosen style"): the compound
 * exercises of the primary slots of the plan these answers give, competition lifts first (squat,
 * bench press, deadlift), then in plan order; one per movement pattern, at most four, loaded
 * with a bar, dumbbells or a machine. Exercises in `keep` (a baseline given or started) stay in
 * the list, so they remain editable. No plan (e.g. a strength style without a barbell): only
 * those.
 */
export async function baselineLifts(
  deps: Deps,
  input: {
    readonly answers: PlanningAnswers;
    /** Exercises the user already gave (or started) a baseline for: kept in the list. */
    readonly keep: readonly ExerciseId[];
  },
): Promise<BaselineLifts> {
  const { answers } = input;
  const preview = await generatePlanPreview(deps, { answers });
  const lifts: BaselineLift[] = [];
  if (preview.ok) {
    const slots = preview.value.proposal.days.flatMap((day) => day.slots);
    const ordered = slots
      .map((slot, index) => ({ slot, index, exercise: deps.content.exercise(slot.exerciseId) }))
      .filter(
        (entry): entry is typeof entry & { exercise: ExerciseDef } =>
          entry.exercise !== undefined &&
          entry.slot.priority === 'primary' &&
          entry.exercise.mechanics === 'compound' &&
          LOADED.has(entry.exercise.load.type),
      )
      .toSorted(
        (a, b) =>
          liftRank(a.slot.lift ?? a.exercise.competitionLift) -
            liftRank(b.slot.lift ?? b.exercise.competitionLift) || a.index - b.index,
      );
    const patterns = new Set<string>();
    for (const { slot, exercise } of ordered) {
      if (lifts.length >= MAX_BASELINE_LIFTS) break;
      if (patterns.has(exercise.pattern)) continue;
      patterns.add(exercise.pattern);
      lifts.push({ exerciseId: exercise.id, lift: exercise.competitionLift ?? slot.lift ?? null });
    }
  }
  for (const exerciseId of input.keep) {
    if (lifts.some((lift) => lift.exerciseId === exerciseId)) continue;
    const exercise = deps.content.exercise(exerciseId);
    if (exercise) lifts.push({ exerciseId: exercise.id, lift: exercise.competitionLift ?? null });
  }
  const { rules } = await deps.rules.resolve({ style: answers.style });
  return { lifts, fallback: calibrationFallback(rules) };
}

/**
 * ONB-08: the starting e1RM a baseline gives, explained (the same pipeline as a logged set), and
 * whether a known 1RM is old enough for the "refined automatically" hint. Null with the reason
 * when the entry cannot give an estimate.
 */
export async function estimateBaseline(
  deps: Deps,
  input: { readonly baseline: Baseline; readonly style: TrainingStyle },
): Promise<Explained<BaselineE1rm | null> | null> {
  const exercise = deps.content.exercise(input.baseline.exerciseId);
  if (!exercise) return null;
  const rules = await exerciseRules(deps, { style: input.style }, exercise);
  return baselineE1rm(input.baseline, exercise.load, today(deps), rules);
}

/** The baseline fields out of range (the last guard; the step validates as the user types). */
export function invalidBaselines(baselines: readonly Baseline[]): boolean {
  const ids = new Set(baselines.map((baseline) => baseline.exerciseId));
  return (
    baselines.length > 20 ||
    ids.size !== baselines.length ||
    baselines.some(
      (baseline) =>
        !(baseline.load.value > 0) ||
        toKg(baseline.load) > SET_LIMITS.loadMaxKg ||
        !Number.isInteger(baseline.reps) ||
        baseline.reps < 1 ||
        baseline.reps > 100 ||
        (baseline.kind === 'oneRepMax' && (baseline.reps !== 1 || baseline.rir !== 0)) ||
        (baseline.rir !== null &&
          (baseline.rir < 0 || baseline.rir > 10 || !Number.isInteger(baseline.rir * 2))),
    )
  );
}
