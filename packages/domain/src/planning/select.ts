import { isAvailable, missingEquipment } from '../equipment';
import { explain, explained, type Explained, type Explanation } from '../explain';
import type {
  AvoidList,
  EffortTarget,
  ExerciseDef,
  Prescription,
  RirRange,
  TemplateDef,
  TemplateSlot,
} from '../model';
import { restSeconds } from '../rest';
import type { Param, ProgressionModel, Range, RuleSlice, TraineeLevel } from '../rules';
import { compareIds, creditFor, liftOf, type ExerciseLookup } from './credits';
import { compareStandard, slotScore, type RankingRules } from './rank';
import type { PlanRequest, RestRules, SlotCandidate } from './types';

/**
 * PLN-02: the template for the user's style and days per week (the cell's default), or the
 * user's own choice. A template serves the levels it lists; a choice that does not fit the
 * days, style or level is refused with the reason rather than bent to fit.
 */
export function selectTemplate(
  templates: readonly TemplateDef[],
  request: Pick<PlanRequest, 'style' | 'level' | 'weekdays' | 'templateId'>,
): Explained<TemplateDef | null> {
  const days = new Set(request.weekdays).size;
  const cell = { style: request.style, days, level: request.level };
  if (request.templateId !== undefined) {
    const chosen = templates.find((template) => template.id === request.templateId);
    if (!chosen || chosen.style !== request.style || chosen.daysPerWeek !== days) {
      return explained(null, 'plan.template.none', {
        args: { ...cell, template: request.templateId, reason: chosen ? 'mismatch' : 'unknown' },
      });
    }
    if (!chosen.levels.includes(request.level)) {
      return explained(null, 'plan.template.levelMismatch', {
        args: { ...cell, template: chosen.id, levels: chosen.levels.join(',') },
      });
    }
    return explained(chosen, 'plan.template.chosen', {
      args: { ...cell, template: chosen.id, split: chosen.split },
    });
  }
  const fitting = templates
    .filter(
      (template) =>
        template.style === request.style &&
        template.daysPerWeek === days &&
        template.levels.includes(request.level),
    )
    .toSorted((a, b) => Number(b.default) - Number(a.default) || compareIds(a.id, b.id));
  const template = fitting[0];
  if (!template)
    return explained(null, 'plan.template.none', { args: { ...cell, reason: 'noTemplate' } });
  return explained(template, 'plan.template.default', {
    args: { ...cell, template: template.id, split: template.split },
  });
}

/** EQP-04 and EXL-08: active, available with the equipment and not on the avoid list. */
export function isEligible(
  exercise: ExerciseDef,
  equipment: ReadonlySet<string>,
  avoid: AvoidList,
): boolean {
  return (
    exercise.status === 'active' &&
    isAvailable(exercise, equipment) &&
    !avoid.exercises.includes(exercise.id) &&
    !avoid.patterns.includes(exercise.pattern)
  );
}

/** Whether an exercise can fill a slot: its pattern, a target credited ≥ 0.5, the lift rule. */
function fitsSlot(exercise: ExerciseDef, slot: TemplateSlot, lookup: ExerciseLookup): boolean {
  if (exercise.pattern !== slot.pattern) return false;
  if (!slot.targets.some((target) => creditFor(exercise, target) >= 0.5)) return false;
  if (slot.lift === undefined) return true;
  if (exercise.competitionLift === slot.lift) return true;
  return slot.allowVariants === true && liftOf(exercise, lookup) === slot.lift;
}

/**
 * Candidates for a slot, best first (PLN-05, MAP-03): the user's favourites, then the MAP-03
 * effectiveness for the slot's targets, then the standard variant (`compareStandard`, M5z), then
 * the ID. `relaxed` drops the pattern (but not the lift rule) and keeps exercises that train a
 * target directly: the fallback when the equipment offers nothing of the slot's pattern.
 */
export function rankCandidates(
  slot: Pick<TemplateSlot, 'pattern' | 'targets' | 'lift' | 'allowVariants'>,
  exercises: readonly ExerciseDef[],
  request: Pick<PlanRequest, 'equipment' | 'avoid' | 'preferred'>,
  lookup: ExerciseLookup,
  rules: RankingRules,
  relaxed = false,
): SlotCandidate[] {
  const fullSlot = slot as TemplateSlot;
  const preferred = new Set<string>(request.preferred);
  return exercises
    .filter((exercise) => isEligible(exercise, request.equipment, request.avoid))
    .filter((exercise) =>
      relaxed
        ? slot.lift === undefined && slot.targets.some((target) => creditFor(exercise, target) >= 1)
        : fitsSlot(exercise, fullSlot, lookup),
    )
    .map((exercise) => ({
      exercise,
      exerciseId: exercise.id,
      score: slotScore(exercise, slot.targets, rules),
      preferred: preferred.has(exercise.id),
    }))
    .toSorted(
      (a, b) =>
        Number(b.preferred) - Number(a.preferred) ||
        b.score - a.score ||
        compareStandard(a.exercise, b.exercise) ||
        compareIds(a.exerciseId, b.exerciseId),
    )
    .map(({ exerciseId, score }) => ({ exerciseId, score }));
}

/** Why the competition lift of a slot cannot be done with this equipment (PLN-05). */
export function liftUnavailable(
  slot: TemplateSlot,
  exercises: readonly ExerciseDef[],
  request: Pick<PlanRequest, 'equipment' | 'avoid'>,
): Explanation {
  const lifts = exercises
    .filter((exercise) => exercise.competitionLift === slot.lift && exercise.status === 'active')
    .toSorted((a, b) => compareIds(a.id, b.id));
  return explain('plan.lift.unavailable', {
    args: {
      lift: slot.lift ?? null,
      slot: slot.key,
      avoided: lifts.some(
        (exercise) =>
          request.avoid.exercises.includes(exercise.id) ||
          request.avoid.patterns.includes(exercise.pattern),
      ),
    },
    children: lifts.map((exercise) => missingEquipment(exercise, request.equipment).why),
  });
}

export type PrescriptionRules = RuleSlice<
  | 'volume.effort.hypertrophyRir'
  | 'volume.effort.strengthRpe'
  | 'volume.effort.strengthAccessoryRpe'
>;

/** RIR range of an effort target (RPE = 10 − RIR). */
export function toRir(effort: EffortTarget): RirRange {
  return 'rir' in effort
    ? [effort.rir[0], effort.rir[1]]
    : [10 - effort.rpe[1], 10 - effort.rpe[0]];
}

/**
 * PLN-07: a slot's prescription. Rep ranges and efforts the template states win; otherwise the
 * exercise's default rep range for the slot's goal and the registry's effort target: hypertrophy
 * RIR 1–2, strength main work RPE 6–9, strength accessories RPE 7–9.
 */
export function prescribe(
  slot: TemplateSlot,
  exercise: ExerciseDef,
  sets: number,
  rules: PrescriptionRules,
): Explained<Prescription> {
  const repRange = slot.repRange ?? exercise.defaults.repRange[slot.goal];
  const { rir: fallback, param } = defaultEffort(slot, rules);
  const rir = slot.effort ? toRir(slot.effort) : fallback;
  let prescription: Prescription;
  if (slot.mode === 'topBackoff') {
    const backoff = slot.backoff ?? { repRange, effort: slot.effort ?? { rir: fallback } };
    prescription = {
      mode: 'topBackoff',
      top: { repRange, rir },
      backoff: {
        sets: Math.max(0, sets - 1),
        repRange: backoff.repRange,
        rir: toRir(backoff.effort),
      },
    };
  } else if (slot.mode === 'rpe') {
    prescription = { mode: 'rpe', sets, repRange, rir };
  } else {
    // Templates use doubleProgression, rpe and topBackoff; other modes are set in the editor.
    prescription = { mode: 'doubleProgression', sets, repRange, rir };
  }
  return explained(prescription, 'plan.prescription', {
    args: {
      slot: slot.key,
      mode: prescription.mode,
      reps: `${repRange[0]}-${repRange[1]}`,
      rir: `${rir[0]}-${rir[1]}`,
      fromTemplate: slot.effort !== undefined,
    },
    params: slot.effort ? [] : [param],
  });
}

/** The registry's effort target for a slot that states none (PLN-07), as RIR, and its parameter. */
function defaultEffort(
  slot: TemplateSlot,
  rules: PrescriptionRules,
): { readonly rir: RirRange; readonly param: Param<unknown> } {
  if (slot.goal === 'hypertrophy') {
    const param = rules['volume.effort.hypertrophyRir'];
    return { rir: [param.value.min, param.value.max], param };
  }
  if (slot.lift !== undefined) {
    const param = rules['volume.effort.strengthRpe'];
    return { rir: rpeToRir(param.value.work), param };
  }
  const param = rules['volume.effort.strengthAccessoryRpe'];
  return { rir: rpeToRir(param.value), param };
}

function rpeToRir(rpe: Range): RirRange {
  return [10 - rpe.max, 10 - rpe.min];
}

/**
 * The progression rule of a slot (PLN-02, PRG-04…06): a double-progression slot progresses by
 * double progression; RPE and top-set slots use the template's main model, novices its novice
 * model (linear progression for the powerlifting templates).
 */
export function progressionOf(
  slot: TemplateSlot,
  template: TemplateDef,
  level: TraineeLevel,
): ProgressionModel {
  if (slot.mode === 'doubleProgression') return 'doubleProgression';
  return level === 'novice' ? template.progression.novice : template.progression.main;
}

/** Rest after a working set (TMR-02): the slot's rest class, else the exercise's. */
export function slotRest(
  slot: TemplateSlot,
  exercise: ExerciseDef,
  rules: RestRules,
): Explained<number> {
  return restSeconds({ restClass: slot.rest ?? exercise.defaults.restClass }, rules);
}
