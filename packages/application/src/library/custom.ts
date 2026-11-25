import type { CustomExercise, ExerciseId, Profile } from '@powr/domain';
import {
  buildCustomExercise,
  customDraftFrom,
  type CustomExerciseInput,
  type CustomExerciseIssue,
} from '@powr/domain/library';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import { loadCustomExercises } from '../usecases/custom-content';
import { equipmentKnown, libraryContext } from './context';

/*
 * Custom exercises (EXL-04): created from scratch or by copying a built-in one, with muscle credits
 * (1.0 / 0.5 / 0.25 / 0), load type and curve class (`equation`, `legPressLike`, `pooled`).
 * Stored in the raw table `customExercises` (backed up), merged into the catalog so they behave
 * like built-in exercises everywhere. One with history or in a plan is retired, not deleted.
 */

export type CustomExerciseError =
  | { readonly kind: 'invalid'; readonly issues: readonly CustomExerciseIssue[] }
  | { readonly kind: 'notFound' };

/** The stored custom exercises (active and retired). */
export async function listCustomExercises(deps: Deps): Promise<readonly CustomExercise[]> {
  return deps.uow.read(['customExercises'], (repos) => repos.customExercises.list());
}

/** EXL-04: the form's starting values, empty or copied from another exercise. */
export function customExerciseDraft(
  deps: Deps,
  from?: ExerciseId,
): { readonly input: CustomExerciseInput | null; readonly copiedFrom: ExerciseId | null } {
  const source = from ? deps.content.exercise(from) : undefined;
  return source
    ? { input: customDraftFrom(source), copiedFrom: source.id }
    : { input: null, copiedFrom: null };
}

/** EXL-04: creates (without `id`) or updates a custom exercise. */
export async function saveCustomExercise(
  deps: Deps,
  input: {
    readonly id?: ExerciseId;
    readonly exercise: CustomExerciseInput;
    readonly copiedFrom?: ExerciseId;
  },
): Promise<Result<CustomExercise, CustomExerciseError>> {
  const { prepared } = await libraryContext(deps);
  const previous = input.id
    ? await deps.uow.read(['customExercises'], (repos) => repos.customExercises.get(input.id!))
    : undefined;
  if (input.id && !previous) return err({ kind: 'notFound' });
  const id = input.id ?? (`cx.${deps.ids.next().toLowerCase()}` as ExerciseId);
  const built = buildCustomExercise(input.exercise, {
    id,
    now: deps.clock.now(),
    ...(previous ? { previous } : {}),
    ...(input.copiedFrom ? { copiedFrom: input.copiedFrom } : {}),
    exercises: deps.content.exercises(),
    isMuscle: (muscle) => deps.content.muscles().muscle(muscle) !== undefined,
    isEquipment: equipmentKnown(deps, prepared),
  });
  if (!built.ok) return err({ kind: 'invalid', issues: built.issues });
  await deps.uow.write(['customExercises'], (repos) => repos.customExercises.put(built.exercise));
  await loadCustomExercises(deps);
  return ok(built.exercise);
}

/**
 * Deletes a custom exercise, or retires it (`deprecated`, hidden from lists and plans, history
 * kept) when sets, plans or planned sessions use it. Its favourite, hidden and avoided marks and
 * its setup memory go with a deletion.
 */
export async function deleteCustomExercise(
  deps: Deps,
  id: ExerciseId,
): Promise<Result<{ readonly outcome: 'deleted' | 'retired' }, { readonly kind: 'notFound' }>> {
  const now = deps.clock.now();
  const result = await deps.uow.write(
    ['customExercises', 'sets', 'plans', 'plannedSessions', 'profile', 'exerciseUserData'],
    async (repos) => {
      const exercise = await repos.customExercises.get(id);
      if (!exercise) return err({ kind: 'notFound' as const });
      const plans = await repos.plans.list();
      const inPlan = plans.some((plan) =>
        plan.mesocycles.some((mesocycle) =>
          mesocycle.days.some((day) => day.slots.some((slot) => slot.exerciseId === id)),
        ),
      );
      const planned = (
        await Promise.all(plans.map((plan) => repos.plannedSessions.byPlan(plan.id)))
      )
        .flat()
        .some((session) => session.slots.some((slot) => slot.exerciseId === id));
      const used = (await repos.sets.byExercise(id)).length > 0 || inPlan || planned;
      if (used) {
        await repos.customExercises.put({ ...exercise, status: 'deprecated', updatedAt: now });
        return ok({ outcome: 'retired' as const });
      }
      await repos.customExercises.delete(id);
      await repos.exerciseUserData.delete(id);
      const profile = await repos.profile.get();
      if (profile) await repos.profile.put(withoutExercise(profile, id, now));
      return ok({ outcome: 'deleted' as const });
    },
  );
  if (result.ok) await loadCustomExercises(deps);
  return result;
}

function withoutExercise(profile: Profile, id: ExerciseId, now: Profile['updatedAt']): Profile {
  return {
    ...profile,
    preferredExercises: profile.preferredExercises.filter((entry) => entry !== id),
    ...(profile.hiddenExercises
      ? { hiddenExercises: profile.hiddenExercises.filter((entry) => entry !== id) }
      : {}),
    avoid: { ...profile.avoid, exercises: profile.avoid.exercises.filter((entry) => entry !== id) },
    updatedAt: now,
  };
}
