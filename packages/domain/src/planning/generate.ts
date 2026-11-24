import { explain, explained, type Explained, type Explanation } from '../explain';
import type { ExerciseId, MuscleId } from '../ids';
import type {
  CompetitionLift,
  PlanDay,
  PlanSlot,
  SlotPriority,
  TemplateDef,
  TemplateSlot,
} from '../model';
import { parentMuscle } from '../volume';
import { liftTargets, muscleTargets, type WorkDay, type WorkSlot } from './allocate';
import {
  allocateWithRepair,
  annotate,
  budgetNote,
  fitTime,
  loweredTargetNote,
  prioritiseForBudget,
  type Drop,
} from './budget';
import { mulberry32 } from './prng';
import { effectiveness } from './rank';
import {
  liftUnavailable,
  prescribe,
  progressionOf,
  rankCandidates,
  selectTemplate,
  slotRest,
} from './select';
import { assignWeekdays } from './spacing';
import type {
  PlanFix,
  PlanProposal,
  PlanRequest,
  PlanningCatalog,
  PlanningRules,
  SlotChoice,
  ValidationContext,
} from './types';
import { inputFixes, validatePlan } from './validate';

/**
 * The plan generator (PLN-01…08, PLN-14; technical concept §8.7.6), a deterministic
 * constructive algorithm: pick the template (PLN-02); fill each slot with the best available,
 * non-avoided exercise (EQP-04, EXL-08, PLN-05, MAP-03; favourites first, competition lifts kept
 * for strength styles); cap novices at five exercises; order lifts and priority work first
 * (PLN-06); set weekly targets (PLN-03); fit each day into the time budget (PLN-14); allocate
 * sets where they close the largest deficit within the caps (PLN-04); map days onto the chosen
 * weekdays with the fewest spacing conflicts; prescribe reps, effort and rest (PLN-07); validate.
 * Same request and seed → same proposal. Null when no template fits or a competition lift of a
 * strength template cannot be done with the equipment; the explanation says why.
 */
export function generatePlan(
  request: PlanRequest,
  catalog: PlanningCatalog,
  rules: PlanningRules,
): Explained<PlanProposal | null> {
  const byId = new Map(catalog.exercises.map((exercise) => [exercise.id, exercise]));
  const lookup = (id: ExerciseId) => byId.get(id);
  const restRules = catalog.restRules ?? (() => rules);
  const notes: Explanation[] = [];

  const chosen = selectTemplate(catalog.templates, request);
  const template = chosen.value;
  if (!template) return { value: null, why: chosen.why };
  notes.push(chosen.why);

  const mesocycle = mesocycleWeeks(template, request, rules);
  if (mesocycle.value === null) return { value: null, why: mesocycle.why };
  notes.push(mesocycle.why);

  const strengthStyle = request.style !== 'bodybuilding';
  const lifts = strengthStyle ? liftsOf(template) : [];
  const liftGoals = liftTargets(lifts, request.level, rules);
  const perExposure = setsPerExposure(
    template,
    liftGoals.map((goal) => goal.value),
    rules,
  );

  const rng = request.variety ? mulberry32(request.seed) : null;
  const pool = rules['planning.variety.pool'].value;
  const drops: Drop[] = [];
  const choices: SlotChoice[] = [];
  const work: WorkDay[] = [];

  for (const day of template.days) {
    const used = new Set<ExerciseId>();
    const slots: WorkSlot[] = [];
    for (const slot of day.slots) {
      const ranked = rankCandidates(slot, catalog.exercises, request, lookup, rules);
      if (ranked.length === 0 && slot.lift !== undefined && strengthStyle) {
        return { value: null, why: liftUnavailable(slot, catalog.exercises, request) };
      }
      let candidates = ranked.filter((candidate) => !used.has(candidate.exerciseId));
      let substituted = false;
      if (candidates.length === 0 && slot.lift === undefined) {
        candidates = rankCandidates(slot, catalog.exercises, request, lookup, rules, true).filter(
          (candidate) => !used.has(candidate.exerciseId),
        );
        substituted = candidates.length > 0;
      }
      const pick = candidates[rng ? Math.floor(rng() * Math.min(pool, candidates.length)) : 0];
      const exercise = pick ? lookup(pick.exerciseId) : undefined;
      if (!pick || !exercise) {
        drops.push({
          dayKey: day.key,
          slotKey: slot.key,
          targets: slot.targets,
          cause: 'equipment',
        });
        notes.push(
          explain('plan.slot.dropped', {
            args: { dayKey: day.key, slot: slot.key, reason: 'noCandidate' },
          }),
        );
        continue;
      }
      used.add(exercise.id);
      const sets = initialSets(slot, perExposure, rules);
      const prescription = prescribe(slot, exercise, sets, rules);
      const rest = slotRest(slot, exercise, restRules(exercise));
      const plan: PlanSlot = {
        key: slot.key,
        exerciseId: exercise.id,
        pattern: slot.pattern,
        targets: slot.targets,
        priority: slot.priority,
        goal: slot.goal,
        ...(slot.lift !== undefined ? { lift: slot.lift } : {}),
        ...(slot.allowVariants !== undefined ? { allowVariants: slot.allowVariants } : {}),
        ...(slot.intensity !== undefined ? { intensity: slot.intensity } : {}),
        prescription: prescription.value,
        progression: progressionOf(slot, template, request.level),
        restSeconds: rest.value,
      };
      slots.push({ exercise, plan });
      const rule = substituted
        ? 'plan.slot.substituted'
        : request.preferred.includes(exercise.id)
          ? 'plan.slot.preferred'
          : 'plan.slot.exercise';
      choices.push({
        dayKey: day.key,
        slotKey: slot.key,
        exerciseId: exercise.id,
        candidates: candidates.slice(0, 5),
        why: explain(rule, {
          args: {
            exercise: exercise.id,
            slot: slot.key,
            pattern: slot.pattern,
            rank: candidates.indexOf(pick) + 1,
            candidates: candidates.length,
            variety: rng !== null,
          },
          params: [rules['ranking.effectiveness']],
          children: [
            ...slot.targets.map((target) => effectiveness(exercise, target, rules).why),
            prescription.why,
            rest.why,
          ],
        }),
      });
    }
    work.push({ key: day.key, slots });
  }

  if (request.level === 'novice') limitNovice(work, drops, notes, rules);
  for (const day of work) orderSlots(day, request.priorities);

  const hypertrophySlots = template.days.flatMap((day) =>
    day.slots.filter((slot) => slot.goal === 'hypertrophy'),
  );
  const hypertrophyMuscles = hypertrophySlots.flatMap((slot) => slot.targets.map(parentMuscle));
  const maintenance = new Set(
    hypertrophyMuscles.filter((muscle) =>
      hypertrophySlots.every(
        (slot) =>
          slot.priority === 'optional' ||
          !slot.targets.some((target) => parentMuscle(target) === muscle),
      ),
    ),
  );
  const targets = muscleTargets(hypertrophyMuscles, { ...request, maintenance }, rules);
  const targetNotes = notes.length;
  notes.push(...targets.map((target) => target.why), ...liftGoals.map((goal) => goal.why));
  const targetMap = new Map(targets.map((target) => [target.value.muscle, target.value.sets]));

  fitTime(work, request.sessionMinutes, drops, notes, rules);
  const allocated = allocateWithRepair(work, targetMap, request, drops, notes, rules);
  const budgeted = prioritiseForBudget(
    allocated,
    targets.map((target) => target.value),
    { template, request, drops },
    rules,
  );
  const final = budgeted ?? allocated;
  work.splice(0, work.length, ...final.work);
  const finalTargets = budgeted?.targets ?? targets.map((target) => target.value);
  for (const [index, target] of finalTargets.entries()) {
    if (target.source !== 'timeBudget') continue;
    // The target explanation says it was lowered and from what (PLN-14).
    notes[targetNotes + index] = loweredTargetNote(targets[index]!.why, target, rules);
  }
  notes.push(
    explain('plan.volume.sets', {
      args: { added: final.added, deficit: Math.round(final.deficit * 10) / 10 },
      params: [
        rules['volume.hypertrophy.weeklyBands'],
        rules['volume.hypertrophy.perSessionSoftCap'],
        rules['planning.slot.sets'],
      ],
    }),
  );

  const planDays: PlanDay[] = work.map((day) => {
    const source = template.days.find((templateDay) => templateDay.key === day.key)!;
    return {
      key: day.key,
      name: source.name,
      weekday: 1,
      slots: day.slots.map((slot) => slot.plan),
    };
  });
  const placed = assignWeekdays(planDays, request.weekdays, request.weekStartsOn, lookup, rules);
  notes.push(placed.why);

  const ctx: ValidationContext = {
    style: request.style,
    level: request.level,
    sessionMinutes: request.sessionMinutes,
    equipment: request.equipment,
    avoid: request.avoid,
    targets: finalTargets,
    liftTargets: liftGoals.map((goal) => goal.value),
    accumulationWeeks: mesocycle.value,
    deloadWeeks: template.mesocycle.deloadWeeks,
    exercise: lookup,
    exercises: catalog.exercises,
    restRules,
  };
  let fixes: readonly PlanFix[] | undefined;
  const budgetFixes = () => (fixes ??= inputFixes(placed.value, ctx, rules));
  const report = annotate(validatePlan(placed.value, ctx, rules), drops, budgetFixes);
  if (budgeted && budgeted.lowered > 0) notes.push(budgetNote(budgeted, budgetFixes(), rules));
  const proposal: PlanProposal = {
    template,
    level: request.level,
    days: placed.value,
    targets: ctx.targets,
    liftTargets: ctx.liftTargets,
    accumulationWeeks: mesocycle.value,
    deloadWeeks: template.mesocycle.deloadWeeks,
    progression: {
      primary: request.level === 'novice' ? template.progression.novice : template.progression.main,
      other: template.progression.accessory,
    },
    choices,
    report,
    notes,
  };
  return explained(proposal, chosen.why.rule, { args: chosen.why.args, children: notes });
}

/**
 * PLN-08: the block length without a choice: the user's own deload interval (an override of
 * `deload.planned.everyWeeks`), else the template's accumulation weeks (5 in every MVP template,
 * the registry's evidence default: deloads every 4–6 weeks, Rogerson 2024, Bell 2023).
 */
export function defaultAccumulationWeeks(
  template: Pick<TemplateDef, 'mesocycle'>,
  rules: Pick<PlanningRules, 'deload.planned.everyWeeks'>,
): number {
  const interval = rules['deload.planned.everyWeeks'];
  const userInterval = interval.meta.origin === 'user' || interval.meta.origin === 'exercise';
  return userInterval ? interval.value : template.mesocycle.accumulationWeeks;
}

/** PLN-08: the template's accumulation weeks, the user's deload interval or their choice (3–8). */
function mesocycleWeeks(
  template: TemplateDef,
  request: PlanRequest,
  rules: PlanningRules,
): Explained<number | null> {
  const range = rules['planning.mesocycle.accumulationWeeks'];
  const interval = rules['deload.planned.everyWeeks'];
  const defaultWeeks = defaultAccumulationWeeks(template, rules);
  const weeks = request.accumulationWeeks ?? defaultWeeks;
  const valid = Number.isInteger(weeks) && weeks >= range.value.min && weeks <= range.value.max;
  return explained(valid ? weeks : null, 'plan.mesocycle', {
    args: {
      accumulationWeeks: weeks,
      deloadWeeks: template.mesocycle.deloadWeeks,
      valid,
      defaultWeeks,
      chosen: request.accumulationWeeks !== undefined && weeks !== defaultWeeks,
    },
    params: [range, interval, rules['deload.content']],
  });
}

function liftsOf(template: TemplateDef): CompetitionLift[] {
  return [
    ...new Set(
      template.days.flatMap((day) => day.slots.flatMap((slot) => (slot.lift ? [slot.lift] : []))),
    ),
  ];
}

/**
 * Heavy sets per heavy or moderate exposure of each lift: the weekly target spread over the
 * exposures, within the per-session 2–3 (PLN-04: add a session rather than more sets).
 */
function setsPerExposure(
  template: TemplateDef,
  goals: readonly { readonly lift: CompetitionLift; readonly heavySets: number }[],
  rules: PlanningRules,
): ReadonlyMap<CompetitionLift, number> {
  const cap = rules['volume.strength.perSessionHeavySets'].value;
  const result = new Map<CompetitionLift, number>();
  for (const goal of goals) {
    const exposures = template.days
      .flatMap((day) => day.slots)
      .filter((slot) => slot.lift === goal.lift && slot.intensity !== 'light').length;
    const sets = exposures === 0 ? cap.max : Math.ceil(goal.heavySets / exposures);
    result.set(goal.lift, Math.min(cap.max, Math.max(cap.min, sets)));
  }
  return result;
}

function initialSets(
  slot: TemplateSlot,
  perExposure: ReadonlyMap<CompetitionLift, number>,
  rules: PlanningRules,
): number {
  const cap = rules['volume.strength.perSessionHeavySets'].value;
  if (slot.lift !== undefined && slot.goal === 'strength') {
    return slot.intensity === 'light' ? cap.max : (perExposure.get(slot.lift) ?? cap.max);
  }
  if (slot.goal === 'strength') return rules['planning.strength.accessorySets'].value;
  return rules['planning.slot.sets'].value.min;
}

const PRIORITY_RANK: Readonly<Record<SlotPriority, number>> = {
  primary: 0,
  secondary: 1,
  optional: 2,
};

/** PLN-02: novices keep at most five working exercises per day, by priority, then template order. */
function limitNovice(work: WorkDay[], drops: Drop[], notes: Explanation[], rules: PlanningRules) {
  const limit = rules['planning.novice.maxWorkingExercises'];
  for (const day of work) {
    if (day.slots.length <= limit.value) continue;
    const keep = day.slots
      .map((slot, index) => ({ slot, index }))
      .toSorted(
        (a, b) =>
          PRIORITY_RANK[a.slot.plan.priority] - PRIORITY_RANK[b.slot.plan.priority] ||
          a.index - b.index,
      )
      .slice(0, limit.value)
      .map(({ slot }) => slot);
    for (const slot of day.slots.filter((candidate) => !keep.includes(candidate))) {
      drops.push({
        dayKey: day.key,
        slotKey: slot.plan.key,
        targets: slot.plan.targets,
        cause: 'template',
      });
      notes.push(
        explain('plan.slot.dropped', {
          args: { dayKey: day.key, slot: slot.plan.key, reason: 'noviceLimit' },
          params: [limit],
        }),
      );
    }
    day.slots.splice(0, day.slots.length, ...day.slots.filter((slot) => keep.includes(slot)));
  }
}

/**
 * PLN-06 order: competition lifts and slots for priority muscles first, then multi-joint, then
 * single-joint work; the template's order within each group.
 */
function orderSlots(day: WorkDay, priorities: readonly MuscleId[]) {
  const rank = (slot: WorkSlot) =>
    slot.plan.lift !== undefined ||
    slot.plan.targets.some((target) => priorities.includes(parentMuscle(target)))
      ? 0
      : slot.exercise.mechanics === 'compound'
        ? 1
        : 2;
  const ordered = day.slots
    .map((slot, index) => ({ slot, index }))
    .toSorted((a, b) => rank(a.slot) - rank(b.slot) || a.index - b.index);
  day.slots.splice(0, day.slots.length, ...ordered.map(({ slot }) => slot));
}
