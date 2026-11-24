/**
 * The active session's derived values, computed from each exercise's history (finished
 * sessions) and this session's sets, so they follow every edit and undo without stored state:
 * the PRs so far (MOT-01) and the first-time milestones.
 */
import type { ExerciseId, SetId } from '../ids';
import { EMPTY_BESTS, exposurePrs, type PrRecord } from './prs';
import { exerciseSetsOf } from './slots';
import type { SessionContext, SessionState } from './types';

export interface SessionPrs {
  readonly prs: readonly PrRecord[];
  readonly firstTimes: readonly { readonly exerciseId: ExerciseId; readonly setId: SetId }[];
}

/** The PRs of the session's sets against each exercise's bests before the session. */
export function sessionPrs(state: SessionState, ctx: SessionContext): SessionPrs {
  const exerciseIds: ExerciseId[] = [];
  for (const set of state.sets) {
    if (set.state === 'done' && !exerciseIds.includes(set.exerciseId))
      exerciseIds.push(set.exerciseId);
  }
  const prs: PrRecord[] = [];
  const firstTimes: { exerciseId: ExerciseId; setId: SetId }[] = [];
  for (const exerciseId of exerciseIds) {
    const exercise = ctx.exercise(exerciseId);
    if (!exercise) continue;
    const history = ctx.history(exerciseId);
    const result = exposurePrs({
      bests: history?.bests ?? EMPTY_BESTS,
      firstExposure: (history?.exposures ?? 0) === 0,
      sets: exerciseSetsOf(state, exerciseId),
      exercise,
      rules: ctx.rules(exerciseId),
      bodyweightKg: ctx.bodyweightKg,
    });
    prs.push(...result.prs);
    if (result.firstTimeSetId) firstTimes.push({ exerciseId, setId: result.firstTimeSetId });
  }
  return { prs, firstTimes };
}
