import type { MuscleId } from '../ids';
import type { MuscleTarget, TemplateDef } from '../model';
import type { KeepFullSource, RuleSlice } from '../rules';
import { parentMuscle } from '../volume';
import {
  SetLedger,
  allocateSets,
  daySeconds,
  type AllocationRules,
  type WorkDay,
} from './allocate';
import { creditFor } from './credits';

/*
 * PLN-14 time-budget prioritisation (product-owner decision, M2b). When the session budget
 * cannot fit every muscle's weekly target, the keep-full group (the user's priority muscles,
 * else the template's emphasis; `planning.timeBudget.fallback`) keeps its full target, every
 * other muscle falls back towards the minimum dose (`volume.hypertrophy.minimumDose`, Iversen
 * 2021), and the plan names the time budget and the input fixes: more minutes per session or
 * another training day.
 */

/** The session budgets onboarding offers (ONB-05: 30, 45, 60, 75, 90 or "90+" minutes). */
const BUDGET_STEP_MINUTES = 15;
const BUDGET_MAX_MINUTES = 90;

/** A plan has at most six training days (ONB-05). */
export const MAX_TRAINING_DAYS = 6;

/**
 * The display groups that keep their full weekly target when the time budget binds, and where
 * the group came from: the first source of `planning.timeBudget.fallback` that names at least
 * one target muscle (the user's priorities, else the display groups the template's hypertrophy
 * slots of the listed priorities target).
 */
export function keepFullGroup(
  targets: readonly MuscleTarget[],
  input: { readonly priorities: readonly MuscleId[]; readonly template: TemplateDef },
  rules: RuleSlice<'planning.timeBudget.fallback'>,
): { readonly muscles: ReadonlySet<MuscleId>; readonly emphasis: KeepFullSource } {
  const fallback = rules['planning.timeBudget.fallback'].value;
  const targeted = new Set(targets.map((target) => target.muscle));
  for (const source of fallback.keepFull) {
    const named =
      source === 'priorities'
        ? input.priorities
        : input.template.days.flatMap((day) =>
            day.slots
              .filter(
                (slot) =>
                  slot.goal === 'hypertrophy' && fallback.templateSlots.includes(slot.priority),
              )
              .flatMap((slot) => slot.targets),
          );
    const muscles = new Set(named.map(parentMuscle).filter((muscle) => targeted.has(muscle)));
    if (muscles.size > 0) return { muscles, emphasis: source };
  }
  return { muscles: new Set(), emphasis: fallback.keepFull.at(-1) ?? 'template' };
}

/**
 * Whether the time budget is what keeps a muscle from another set: no hypertrophy slot that
 * trains it can take one, and at least one is stopped by the budget, or a slot for it was left
 * out to fit the budget (`timeDropped`).
 */
export function budgetBound(
  muscle: MuscleId,
  ledger: SetLedger,
  timeDropped: ReadonlySet<MuscleId>,
): boolean {
  let blocked = timeDropped.has(muscle);
  for (const [dayIndex, day] of ledger.days.entries()) {
    for (const slot of day.slots) {
      if (slot.plan.goal !== 'hypertrophy' || creditFor(slot.exercise, muscle) <= 0) continue;
      const blocker = ledger.blocker(dayIndex, slot);
      if (blocker === null) return false;
      if (blocker === 'timeBudget') blocked = true;
    }
  }
  return blocked;
}

/** Sets rounded down to half sets (a lowered target never exceeds what the plan achieves). */
export function halfSetsDown(value: number): number {
  return Math.floor(value * 2 + 1e-9) / 2;
}

/**
 * The session budget that fits the full targets (the `sessionMinutes` fix): the week allocated
 * again without a budget towards `targets`, its longest day rounded up to the next budget step
 * above the current budget; beyond 90 minutes null ("90+"). The days are copied, not changed.
 */
export function suggestedMinutes(
  work: readonly WorkDay[],
  targets: ReadonlyMap<MuscleId, number>,
  budget: number,
  rules: AllocationRules,
): number | null {
  const copy = work.map((day) => ({
    key: day.key,
    slots: day.slots.map((slot) => ({ ...slot })),
  }));
  allocateSets(new SetLedger(copy, targets, null, rules), targets, []);
  const longest = Math.max(0, ...copy.map((day) => daySeconds(day, rules))) / 60;
  const steps = Math.max(
    Math.ceil(longest / BUDGET_STEP_MINUTES - 1e-9),
    Math.floor(budget / BUDGET_STEP_MINUTES) + 1,
  );
  const minutes = steps * BUDGET_STEP_MINUTES;
  return minutes > BUDGET_MAX_MINUTES ? null : minutes;
}
