import { explain, paramRef, type Explanation } from '../explain';
import type { MuscleId } from '../ids';
import type { MuscleTarget, TemplateDef } from '../model';
import type { KeepFullSource, RuleSlice } from '../rules';
import { parentMuscle } from '../volume';
import {
  SetLedger,
  allocateSets,
  daySeconds,
  lexLess,
  totalDeficit,
  type AllocationRules,
  type WorkDay,
  type WorkSlot,
} from './allocate';
import { setsOf, withSets } from './analysis';
import { creditFor } from './credits';
import type { IssueCause, PlanFix, PlanRequest, PlanningRules, ValidationReport } from './types';

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
function keepFullGroup(
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
function budgetBound(
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
function halfSetsDown(value: number): number {
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

/** A slot the planner had to leave out, and why (for the cause of the issues it leaves). */
export interface Drop {
  readonly dayKey: string;
  readonly slotKey: string;
  readonly targets: readonly MuscleId[];
  readonly cause: IssueCause;
}

/**
 * §8.7.6 step 7 (PLN-14): while a day is over its budget plus the tolerance, drop optional
 * accessories, then secondary ones (last first), then cut lift slots to the per-session minimum,
 * then drop optional and secondary lift slots. Primary slots and slots the user locked (PLN-13)
 * stay; anything still over is flagged by the validator with fixes.
 */
export function fitTime(
  work: WorkDay[],
  budget: number | null,
  drops: Drop[],
  notes: Explanation[],
  rules: PlanningRules,
) {
  if (budget === null) return;
  const tolerance = rules['planning.sessionBudget.tolerancePct'];
  const limit = budget * 60 * (1 + tolerance.value / 100);
  const minHeavy = rules['volume.strength.perSessionHeavySets'].value.min;
  for (const day of work) {
    const over = () => daySeconds(day, rules) > limit + 1e-6;
    const trim = (test: (slot: WorkSlot) => boolean) => {
      for (let index = day.slots.length - 1; index >= 0 && over(); index--) {
        const slot = day.slots[index]!;
        if (slot.plan.locked === true || !test(slot)) continue;
        day.slots.splice(index, 1);
        drops.push({
          dayKey: day.key,
          slotKey: slot.plan.key,
          targets: slot.plan.targets,
          cause: 'timeBudget',
        });
        notes.push(
          explain('plan.time.trimmed', {
            args: { dayKey: day.key, slot: slot.plan.key, budget, action: 'removed' },
            params: [tolerance],
          }),
        );
      }
    };
    trim((slot) => slot.plan.lift === undefined && slot.plan.priority === 'optional');
    trim((slot) => slot.plan.lift === undefined && slot.plan.priority === 'secondary');
    for (const slot of day.slots) {
      if (!over()) break;
      if (
        slot.plan.lift !== undefined &&
        slot.plan.locked !== true &&
        setsOf(slot.plan.prescription) > minHeavy
      ) {
        slot.plan = { ...slot.plan, prescription: withSets(slot.plan.prescription, minHeavy) };
        notes.push(
          explain('plan.time.trimmed', {
            args: {
              dayKey: day.key,
              slot: slot.plan.key,
              budget,
              action: 'fewerSets',
              sets: minHeavy,
            },
            params: [tolerance, rules['volume.strength.perSessionHeavySets']],
          }),
        );
      }
    }
    trim((slot) => slot.plan.priority === 'optional');
    trim((slot) => slot.plan.priority === 'secondary');
  }
}

/** An allocated week: the slots before allocation (`start`), after it, and what it achieved. */
export interface Allocation {
  readonly start: readonly WorkDay[];
  readonly work: WorkDay[];
  readonly added: number;
  readonly deficit: number;
}

/**
 * §8.7.6 local repair: allocates the sets, then, while the time budget leaves target muscles
 * short, tries leaving out one optional accessory (whose warm-up and transition time then goes
 * to sets for the targets) and keeps the removal that closes the most of the weekly deficit.
 */
export function allocateWithRepair(
  base: readonly WorkDay[],
  targets: ReadonlyMap<MuscleId, number>,
  request: PlanRequest,
  drops: Drop[],
  notes: Explanation[],
  rules: PlanningRules,
): Allocation {
  const run = (days: readonly WorkDay[]) => {
    const work = days.map((day) => ({
      key: day.key,
      slots: day.slots.map((slot) => ({ ...slot })),
    }));
    const ledger = new SetLedger(work, targets, request.sessionMinutes, rules);
    const added = allocateSets(ledger, targets, request.priorities);
    return { start: days, work, added, deficit: totalDeficit(ledger, targets) };
  };
  let best = run(base);
  if (request.sessionMinutes === null) return best;
  for (;;) {
    let improved: (ReturnType<typeof run> & { dayKey: string; slot: WorkSlot }) | null = null;
    for (const [dayIndex, day] of best.start.entries()) {
      for (const slot of day.slots) {
        if (
          slot.plan.priority !== 'optional' ||
          slot.plan.lift !== undefined ||
          slot.plan.locked === true
        )
          continue;
        const without = best.start.map((other, index) =>
          index === dayIndex
            ? { key: other.key, slots: other.slots.filter((s) => s !== slot) }
            : other,
        );
        const trial = run(without);
        if (trial.deficit < (improved?.deficit ?? best.deficit - 1))
          improved = { ...trial, dayKey: day.key, slot };
      }
    }
    if (!improved) return best;
    drops.push({
      dayKey: improved.dayKey,
      slotKey: improved.slot.plan.key,
      targets: improved.slot.plan.targets,
      cause: 'timeBudget',
    });
    notes.push(
      explain('plan.time.trimmed', {
        args: {
          dayKey: improved.dayKey,
          slot: improved.slot.plan.key,
          action: 'removedForVolume',
          deficit: Math.round(improved.deficit * 10) / 10,
        },
        params: [
          rules['planning.sessionBudget.tolerancePct'],
          rules['volume.hypertrophy.weeklyBands'],
        ],
      }),
    );
    best = improved;
  }
}

/**
 * PLN-14 time-budget prioritisation: when the budget leaves target muscles short, allocates the
 * same slots again tier by tier (every target muscle to the minimum dose, the keep-full group to
 * its full target, then the rest) and keeps that allocation if it is better in the same order
 * (the one-set-at-a-time allocation is greedy, so it can lose). Then it lowers the stored target
 * of each other muscle the budget still keeps short to what it gets, at least the minimum dose
 * (`source: 'timeBudget'`, `full` the old target). Maintenance and priority targets are never
 * lowered; keep-full muscles that stay short keep their target (and their low-volume issue).
 * Null when the budget does not bind, so such plans come out exactly as without this step.
 */
export function prioritiseForBudget(
  allocated: Allocation,
  targets: readonly MuscleTarget[],
  input: {
    readonly template: TemplateDef;
    readonly request: PlanRequest;
    readonly drops: readonly Drop[];
  },
  rules: PlanningRules,
):
  | (Allocation & {
      readonly targets: readonly MuscleTarget[];
      readonly lowered: number;
      readonly emphasis: KeepFullSource;
    })
  | null {
  const { request } = input;
  if (request.sessionMinutes === null) return null;
  const full = new Map(targets.map((target) => [target.muscle, target.sets]));
  const timeDropped = new Set(
    input.drops
      .filter((drop) => drop.cause === 'timeBudget')
      .flatMap((drop) => drop.targets.map(parentMuscle)),
  );
  const short = (ledger: SetLedger, target: MuscleTarget) =>
    ledger.fractional(target.muscle) + 1e-9 < target.sets &&
    budgetBound(target.muscle, ledger, timeDropped);
  const current = new SetLedger(allocated.work, full, request.sessionMinutes, rules);
  if (!targets.some((target) => short(current, target))) return null;

  const keep = keepFullGroup(
    targets,
    { priorities: request.priorities, template: input.template },
    rules,
  );
  const minimumDose = rules['volume.hypertrophy.minimumDose'].value.setsPerWeek;
  // What is still missing per tier: below the minimum dose, keep-full group, everyone else.
  const gaps = (candidate: SetLedger) => {
    const missing = [0, 0, 0];
    for (const target of targets) {
      const sets = candidate.fractional(target.muscle);
      const dose = Math.min(target.sets, minimumDose);
      missing[0]! += Math.max(0, dose - sets);
      missing[keep.muscles.has(target.muscle) ? 1 : 2]! += Math.max(
        0,
        target.sets - Math.max(sets, dose),
      );
    }
    return missing;
  };
  const tiered = allocated.start.map((day) => ({
    key: day.key,
    slots: day.slots.map((slot) => ({ ...slot })),
  }));
  const tieredLedger = new SetLedger(tiered, full, request.sessionMinutes, rules);
  const tieredAdded = allocateSets(tieredLedger, full, request.priorities, {
    minimumDose,
    keepFull: keep.muscles,
  });
  const better = lexLess(gaps(tieredLedger), gaps(current));
  const work = better ? tiered : allocated.work;
  const ledger = better ? tieredLedger : current;
  const added = better ? tieredAdded : allocated.added;
  let lowered = 0;
  const stored = targets.map((target): MuscleTarget => {
    if (
      keep.muscles.has(target.muscle) ||
      target.source === 'maintenance' ||
      target.source === 'priority' ||
      !short(ledger, target)
    )
      return target;
    const sets = Math.min(
      target.sets,
      Math.max(minimumDose, halfSetsDown(ledger.fractional(target.muscle))),
    );
    if (sets >= target.sets) return target;
    lowered++;
    return { muscle: target.muscle, sets, source: 'timeBudget', full: target.sets };
  });
  return {
    start: allocated.start,
    work,
    added,
    deficit: totalDeficit(ledger, new Map(stored.map((target) => [target.muscle, target.sets]))),
    targets: stored,
    lowered,
    emphasis: keep.emphasis,
  };
}

/**
 * Names the cause of issues the generator could not avoid: a muscle whose slot was dropped
 * (no available exercise, the novice limit, the time budget) or whose sessions are full. A
 * low-volume issue the time budget causes gets the input fixes (more minutes, another day).
 */
export function annotate(
  report: ValidationReport,
  drops: readonly Drop[],
  budgetFixes: () => readonly PlanFix[],
): ValidationReport {
  const dropCause = new Map<MuscleId, IssueCause>();
  for (const drop of drops) {
    for (const target of drop.targets) {
      const muscle = parentMuscle(target);
      if (!dropCause.has(muscle)) dropCause.set(muscle, drop.cause);
    }
  }
  const issues = report.issues.map((issue) => {
    if (issue.subject.kind !== 'muscle') return issue;
    const cause = dropCause.get(issue.subject.muscle);
    if (cause === undefined || (issue.cause !== null && issue.cause !== 'template')) return issue;
    const lowVolume =
      issue.why.rule === 'validate.volume.low' || issue.why.rule === 'validate.volume.belowFloor';
    if (cause !== 'timeBudget' || !lowVolume) return { ...issue, cause };
    const added = budgetFixes().filter(
      (fix) => !issue.fixes.some((existing) => existing.kind === fix.kind),
    );
    return { ...issue, cause, fixes: [...issue.fixes, ...added] };
  });
  return {
    ...report,
    issues,
    ok: issues.every((issue) => issue.severity !== 'violation' || issue.cause !== null),
  };
}

/** A target's explanation once the time budget lowered it: the new sets and the full target. */
export function loweredTargetNote(
  before: Explanation,
  target: MuscleTarget,
  rules: RuleSlice<'volume.hypertrophy.minimumDose' | 'planning.timeBudget.fallback'>,
): Explanation {
  return {
    ...before,
    args: { ...before.args, sets: target.sets, source: 'timeBudget', full: target.full ?? null },
    params: [
      ...before.params,
      paramRef(rules['volume.hypertrophy.minimumDose']),
      paramRef(rules['planning.timeBudget.fallback']),
    ],
  };
}

/**
 * The plan's time-budget note (PLN-14): how many targets the budget lowered, which group kept
 * its full target, and the session length that would fit them (the `sessionMinutes` fix).
 */
export function budgetNote(
  budgeted: { readonly lowered: number; readonly emphasis: KeepFullSource },
  fixes: readonly PlanFix[],
  rules: RuleSlice<
    | 'volume.hypertrophy.minimumDose'
    | 'planning.timeBudget.fallback'
    | 'volume.hypertrophy.weeklyBands'
  >,
): Explanation {
  const longer = fixes.find((fix) => fix.kind === 'sessionMinutes');
  return explain('plan.volume.budget', {
    args: {
      lowered: budgeted.lowered,
      minutes: longer?.kind === 'sessionMinutes' ? longer.minutes : null,
      emphasis: budgeted.emphasis,
    },
    params: [
      rules['volume.hypertrophy.minimumDose'],
      rules['planning.timeBudget.fallback'],
      rules['volume.hypertrophy.weeklyBands'],
    ],
  });
}
