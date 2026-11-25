import {
  toLocalDate,
  type ExerciseId,
  type ExerciseUserData,
  type MuscleId,
  type PlanId,
  type PlannedSessionId,
  type PlanSlot,
} from '@powr/domain';
import {
  muscleRanking,
  regionsOf,
  type RankMode,
  type RankedExercise,
} from '@powr/domain/analytics';
import type { Explained } from '@powr/domain/explain';
import {
  exerciseInfo,
  searchLibrary,
  type ExerciseInfo,
  type LibraryItem,
  type LibraryQuery,
} from '@powr/domain/library';
import { slotForExercise, type PlanEdit } from '@powr/domain/planning';
import { restSeconds } from '@powr/domain/rest';
import {
  calibrationStatus,
  currentE1rm,
  type CalibrationStatus,
  type ExerciseBests,
  type ExposureSummary,
  type PrRecord,
} from '@powr/domain/session';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import { dispatch } from '../session/workout';
import { libraryContext } from './context';

/*
 * Browsing the library and the body map (EXL-02, EXL-03, EXL-07, MAP-02, MAP-03, MAP-05): search
 * and filters, the exercise detail with the user's history and setup memory, a muscle's ranked
 * exercise list (Effectiveness or Focus, with the "why"), the body map's regions per view, and the
 * map's actions: add an exercise to today's session, place it in the plan (the edits for the
 * planning entry's `previewPlanEdit`/`savePlanEdit`, PLN-09), show its history (insights entry).
 */

/** EXL-02: search by name and synonyms, filtered (AND across filters), best match first. */
export async function searchExercises(
  deps: Deps,
  query: LibraryQuery = {},
): Promise<readonly LibraryItem[]> {
  const { user } = await libraryContext(deps);
  return searchLibrary(deps.content.exercises(), query, user);
}

export interface ExerciseDetailView {
  readonly info: ExerciseInfo;
  /** TMR-02 default rest for the exercise, with "Why?". */
  readonly rest: Explained<number>;
  readonly history: {
    readonly exposures: number;
    readonly firstDate: string | null;
    readonly lastDate: string | null;
    readonly last: ExposureSummary | null;
    readonly e1rmKg: number | null;
    readonly calibration: CalibrationStatus;
    readonly bests: ExerciseBests | null;
  };
  /** The latest PRs, newest first (MOT-01 types). */
  readonly prs: readonly PrRecord[];
  /** EXL-09 setup memory and the ANL-04 training max. */
  readonly userData: ExerciseUserData | null;
}

/** EXL-03: the detail view's data (cues and mapping come with `info.exercise`). */
export async function exerciseDetail(
  deps: Deps,
  exerciseId: ExerciseId,
): Promise<ExerciseDetailView | null> {
  const exercise = deps.content.exercise(exerciseId);
  if (!exercise) return null;
  const { prepared, user } = await libraryContext(deps);
  const loaded = await deps.uow.read(
    ['dExerciseState', 'dPrs', 'exerciseUserData'],
    async (repos) => ({
      state: (await repos.derived.exerciseStates([exerciseId]))[0] ?? null,
      prs: await repos.derived.prsByExercise(exerciseId),
      userData: await repos.exerciseUserData.get(exerciseId),
    }),
  );
  const rules = prepared.rules(exerciseId);
  const state = loaded.state;
  return {
    info: exerciseInfo(exercise, deps.content.exercises(), user),
    rest: restSeconds({ restClass: exercise.defaults.restClass }, rules),
    history: {
      exposures: state?.exposures ?? 0,
      firstDate: state?.firstDate ?? null,
      lastDate: state?.lastDate ?? null,
      last: state?.last ?? null,
      e1rmKg: currentE1rm(state),
      calibration: calibrationStatus(state, rules),
      bests: state?.bests ?? null,
    },
    prs: loaded.prs
      .toSorted((a, b) => (a.localDate < b.localDate ? 1 : a.localDate > b.localDate ? -1 : 0))
      .slice(0, 10),
    userData: loaded.userData ?? null,
  };
}

/**
 * MAP-02/03: the exercises that train a muscle (display group or sub-region), ranked by
 * Effectiveness (default) or Focus, filtered to the equipment and without avoided or hidden ones;
 * with `includeUnavailable` the others follow, naming the missing equipment.
 */
export async function muscleExercises(
  deps: Deps,
  input: {
    readonly muscle: MuscleId;
    readonly mode?: RankMode;
    readonly includeUnavailable?: boolean;
  },
): Promise<readonly RankedExercise[]> {
  const { prepared, user } = await libraryContext(deps);
  const ids = deps.content.exercises().map((exercise) => exercise.id);
  const states = await deps.uow.read(['dExerciseState'], (repos) =>
    repos.derived.exerciseStates(ids),
  );
  const byId = new Map(states.map((state) => [state.exerciseId, state]));
  return muscleRanking(
    {
      muscle: input.muscle,
      mode: input.mode ?? 'effectiveness',
      exercises: deps.content.exercises(),
      equipment: user.equipment,
      avoid: user.avoid,
      hidden: user.hidden,
      favourites: user.favourites,
      history: (id) => {
        const state = byId.get(id);
        return state ? { lastDate: state.lastDate, last: state.last } : null;
      },
      includeUnavailable: input.includeUnavailable ?? false,
    },
    prepared.rules(null),
  );
}

/** MAP-01, MAP-06: the display groups visible in each view with their region IDs. */
export function bodyMapRegions(deps: Deps): {
  readonly front: readonly { readonly muscle: MuscleId; readonly region: string }[];
  readonly back: readonly { readonly muscle: MuscleId; readonly region: string }[];
} {
  const groups = deps.content.muscles().groups;
  return { front: regionsOf(groups, 'front'), back: regionsOf(groups, 'back') };
}

export type AddToTodayOutcome =
  | { readonly kind: 'addedToSession'; readonly slotKey: string | null }
  | { readonly kind: 'addedToPlanned'; readonly plannedSessionId: PlannedSessionId }
  | { readonly kind: 'noSessionToday' };

/**
 * MAP-05 "add to today's session": into the active session (WKT-09), else into today's planned
 * session (this session only), else `noSessionToday` (the screen offers a freestyle workout with
 * it, `startWorkout` of the session entry).
 */
export async function addExerciseToToday(
  deps: Deps,
  exerciseId: ExerciseId,
): Promise<Result<AddToTodayOutcome, { readonly kind: 'unknownExercise' | 'rejected' }>> {
  const exercise = deps.content.exercise(exerciseId);
  if (!exercise) return err({ kind: 'unknownExercise' });
  const active = await deps.uow.read(['sessions'], (repos) => repos.sessions.getActive());
  if (active) {
    const outcome = await dispatch(deps, { type: 'ADD_EXERCISE', exerciseId });
    if (!outcome.ok) return err({ kind: 'rejected' });
    const added = outcome.value.view.session.exercises.findLast(
      (slot) => slot.exerciseId === exerciseId,
    );
    return ok({ kind: 'addedToSession', slotKey: added?.key ?? null });
  }
  const { prepared } = await libraryContext(deps);
  const today = toLocalDate(deps.clock.now());
  const rules = prepared.rules(exerciseId);
  const effort = rules['volume.effort.hypertrophyRir'].value;
  const added = await deps.uow.write(['plannedSessions'], async (repos) => {
    const planned = (await repos.plannedSessions.inRange(today, today)).find(
      (session) => session.status === 'planned',
    );
    if (!planned) return null;
    const slot = slotForExercise(
      exercise,
      {
        goal: 'hypertrophy',
        sets: rules['planning.slot.sets'].value.min,
        rir: [effort.min, effort.max],
        existingKeys: planned.slots.map((entry) => entry.key),
      },
      rules,
    );
    await repos.plannedSessions.putMany([
      { ...planned, slots: [...planned.slots, slot], revision: planned.revision + 1 },
    ]);
    return planned.id;
  });
  return ok(
    added ? { kind: 'addedToPlanned', plannedSessionId: added } : { kind: 'noSessionToday' },
  );
}

export interface PlanPlacement {
  readonly dayKey: string;
  readonly dayName: string;
  /** Slots it could replace (same pattern, or training the muscle or its primary muscles). */
  readonly swaps: readonly {
    readonly slotKey: string;
    readonly current: ExerciseId;
    readonly edit: PlanEdit;
  }[];
  /** A new slot for it (the plan's hypertrophy defaults). */
  readonly add: PlanEdit;
}

/**
 * MAP-05 "add it to a plan day (opens PLN-09)": the edits that place the exercise on each day of
 * the current mesocycle, for the planning entry's `previewPlanEdit` and `savePlanEdit`.
 */
export async function planPlacements(
  deps: Deps,
  input: { readonly exerciseId: ExerciseId; readonly muscle?: MuscleId },
): Promise<{ readonly planId: PlanId; readonly days: readonly PlanPlacement[] } | null> {
  const exercise = deps.content.exercise(input.exerciseId);
  const { prepared } = await libraryContext(deps);
  const plan = prepared.plan;
  const mesocycle =
    plan?.mesocycles.find((entry) => entry.status === 'active') ?? plan?.mesocycles.at(-1);
  if (!exercise || !plan || !mesocycle) return null;
  const rules = prepared.rules(exercise.id);
  const effort = rules['volume.effort.hypertrophyRir'].value;
  const primaries = new Set(
    exercise.muscles.filter((credit) => credit.credit === 1).map((credit) => credit.muscle),
  );
  const fits = (slot: PlanSlot) =>
    slot.exerciseId !== exercise.id &&
    (slot.pattern === exercise.pattern ||
      (input.muscle !== undefined && slot.targets.includes(input.muscle)) ||
      slot.targets.some((target) => primaries.has(target)));
  return {
    planId: plan.id,
    days: mesocycle.days.map((day) => ({
      dayKey: day.key,
      dayName: day.name.en,
      swaps: day.slots.filter(fits).map((slot) => ({
        slotKey: slot.key,
        current: slot.exerciseId,
        edit: { kind: 'swapExercise', dayKey: day.key, slotKey: slot.key, exerciseId: exercise.id },
      })),
      add: {
        kind: 'addSlot',
        dayKey: day.key,
        slot: slotForExercise(
          exercise,
          {
            goal: 'hypertrophy',
            sets: rules['planning.slot.sets'].value.min,
            rir: [effort.min, effort.max],
            existingKeys: day.slots.map((slot) => slot.key),
          },
          rules,
        ),
      },
    })),
  };
}
