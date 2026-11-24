import type { ExerciseId, MuscleId, PlanId, PlanSlot } from '@powr/domain';
import { itemsOf } from '@powr/domain/equipment';
import { rankCandidates, slotForExercise, type SlotCandidate } from '@powr/domain/planning';

import type { Deps } from '../deps';
import { err, ok, type Result } from '../result';
import { exerciseLookup, planningRules } from './context';
import { currentMesocycle, planEquipment } from './plan';

/** What the plan editor's swap and add lists are ranked against: equipment, avoid list, rules. */
async function editorContext(deps: Deps, planId: PlanId) {
  const loaded = await deps.uow.read(['plans', 'profile', 'equipmentProfiles'], async (repos) => ({
    plan: await repos.plans.get(planId),
    profile: await repos.profile.get(),
    equipment: await repos.equipment.list(),
  }));
  const { plan, profile } = loaded;
  const mesocycle = plan ? currentMesocycle(plan) : undefined;
  const equipment = plan ? planEquipment(plan, loaded.equipment) : undefined;
  if (!plan || !mesocycle || !equipment) return null;
  const { rules, restRules } = await planningRules(deps, {
    style: plan.style,
    level: mesocycle.level,
  });
  return {
    plan,
    mesocycle,
    rules,
    restRules,
    request: {
      equipment: itemsOf(equipment),
      avoid: profile?.avoid ?? { exercises: [], patterns: [] },
      preferred: profile?.preferredExercises ?? [],
    },
  };
}

/**
 * PLN-09 swap list: equipment-valid, non-avoided exercises for a slot of the current week, best
 * first (the same rules and MAP-03 ranking as plan generation, EQP-04). Empty when the slot is
 * gone.
 */
export async function slotCandidates(
  deps: Deps,
  input: { readonly planId: PlanId; readonly dayKey: string; readonly slotKey: string },
): Promise<readonly SlotCandidate[]> {
  const context = await editorContext(deps, input.planId);
  const slot = context?.mesocycle.days
    .find((day) => day.key === input.dayKey)
    ?.slots.find((candidate) => candidate.key === input.slotKey);
  if (!context || !slot) return [];
  return rankCandidates(
    slot,
    deps.content.exercises(),
    context.request,
    exerciseLookup(deps),
    context.rules,
  );
}

/**
 * PLN-09 "add an exercise": equipment-valid, non-avoided exercises that train a display group
 * directly, best first (MAP-03).
 */
export async function addCandidates(
  deps: Deps,
  input: { readonly planId: PlanId; readonly muscle: MuscleId },
): Promise<readonly SlotCandidate[]> {
  const context = await editorContext(deps, input.planId);
  if (!context) return [];
  return rankCandidates(
    { pattern: 'core', targets: [input.muscle] },
    deps.content.exercises(),
    context.request,
    exerciseLookup(deps),
    context.rules,
    true,
  );
}

/**
 * PLN-09: a new slot for an exercise the user adds: the plan's hypertrophy defaults (the slot
 * minimum of sets, the registry's RIR target), the exercise's rep range and rest class.
 */
export async function newPlanSlot(
  deps: Deps,
  input: {
    readonly planId: PlanId;
    readonly exerciseId: ExerciseId;
    readonly existingKeys: readonly string[];
  },
): Promise<Result<PlanSlot, { readonly kind: 'notFound' }>> {
  const context = await editorContext(deps, input.planId);
  const exercise = deps.content.exercise(input.exerciseId);
  if (!context || !exercise) return err({ kind: 'notFound' });
  const effort = context.rules['volume.effort.hypertrophyRir'].value;
  return ok(
    slotForExercise(
      exercise,
      {
        goal: 'hypertrophy',
        sets: context.rules['planning.slot.sets'].value.min,
        rir: [effort.min, effort.max],
        existingKeys: input.existingKeys,
      },
      context.restRules(exercise),
    ),
  );
}
