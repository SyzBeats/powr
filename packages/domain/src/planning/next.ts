import { explain, explained, type Explained, type Explanation } from '../explain';
import type { ExerciseId, LocalDate, MuscleId } from '../ids';
import type { Mesocycle, MuscleTarget, PlanDay, PlanSlot, Prescription } from '../model';
import { restSeconds } from '../rest';
import { parentMuscle } from '../volume';
import { SetLedger, allocateSets, liftTargets, muscleTargets, type WorkDay } from './allocate';
import { setsOf, withSets } from './analysis';
import { compareIds, type ExerciseLookup } from './credits';
import { isEligible, rankCandidates } from './select';
import type { PlanRequest, PlanningCatalog, PlanningRules, ValidationReport } from './types';
import { validatePlan } from './validate';

/** One exercise change between mesocycles. */
export interface Rotation {
  readonly dayKey: string;
  readonly slotKey: string;
  readonly from: ExerciseId;
  readonly to: ExerciseId;
  /** `rotation` (PLN-13) or `unavailable` (the equipment or avoid list changed, EQP-05). */
  readonly reason: 'rotation' | 'unavailable';
}

export interface NextMesocycleProposal {
  readonly mesocycle: Mesocycle;
  readonly rotations: readonly Rotation[];
  readonly report: ValidationReport;
  readonly notes: readonly Explanation[];
}

export interface NextMesocycleInput {
  readonly current: Mesocycle;
  /** The user's situation now: level (re-evaluated, PRG-10), equipment, avoid list, budget. */
  readonly request: PlanRequest;
  /** Mean weekly fractional sets per display group logged in the accumulation weeks, if any. */
  readonly logged: ReadonlyMap<MuscleId, number> | null;
  readonly startDate: LocalDate;
}

/**
 * PLN-13: the next mesocycle. Competition lifts and locked slots keep their exercise; per muscle
 * 1–2 other slots rotate to the best available alternative not used in the last mesocycle
 * (PLN-05: systematic variation between mesocycles, none within); exercises that are no longer
 * available or now avoided are replaced. Weekly targets are re-derived for the (re-evaluated)
 * level and, where the logs show less volume than planned, start from the logged volume, at most
 * ×1.2 (PLN-03; increases from performance trends are PRG-16, v1.x). Sets are re-allocated.
 */
export function proposeNextMesocycle(
  input: NextMesocycleInput,
  catalog: PlanningCatalog,
  rules: PlanningRules,
): Explained<NextMesocycleProposal> {
  const byId = new Map(catalog.exercises.map((exercise) => [exercise.id, exercise]));
  const lookup = (id: ExerciseId) => byId.get(id);
  const restRules = catalog.restRules ?? (() => rules);
  const { current, request } = input;
  const notes: Explanation[] = [];
  const rotations: Rotation[] = [];
  const perMuscle = rules['planning.rotation.perMuscle'];
  // An edit saved "from the next mesocycle" (PLN-09) is the starting point.
  const baseDays = current.next?.days ?? current.days;
  const used = new Set(current.days.flatMap((day) => day.slots.map((slot) => slot.exerciseId)));
  const days = baseDays.map((day) => ({ ...day, slots: [...day.slots] }));

  const swap = (dayIndex: number, slotIndex: number, reason: Rotation['reason']): boolean => {
    const day = days[dayIndex]!;
    const slot = day.slots[slotIndex]!;
    const inDay = new Set(day.slots.map((other) => other.exerciseId));
    const candidates = rankCandidates(slot, catalog.exercises, request, lookup, rules).filter(
      (candidate) => !inDay.has(candidate.exerciseId),
    );
    const pick =
      candidates.find((candidate) => !used.has(candidate.exerciseId)) ??
      (reason === 'unavailable' ? candidates[0] : undefined);
    const exercise = pick ? lookup(pick.exerciseId) : undefined;
    if (!exercise) return false;
    const repRange = exercise.defaults.repRange[slot.goal];
    day.slots[slotIndex] = {
      ...slot,
      exerciseId: exercise.id,
      prescription:
        slot.lift === undefined ? withRepRange(slot.prescription, repRange) : slot.prescription,
      restSeconds: restSeconds({ restClass: exercise.defaults.restClass }, restRules(exercise))
        .value,
    };
    rotations.push({
      dayKey: day.key,
      slotKey: slot.key,
      from: slot.exerciseId,
      to: exercise.id,
      reason,
    });
    notes.push(
      explain('plan.slot.rotated', {
        args: { slot: slot.key, from: slot.exerciseId, to: exercise.id, reason },
        params: [perMuscle, rules['ranking.effectiveness']],
      }),
    );
    return true;
  };

  // Exercises the equipment or the avoid list no longer allows come first (EQP-05).
  days.forEach((day, dayIndex) =>
    day.slots.forEach((slot, slotIndex) => {
      const exercise = lookup(slot.exerciseId);
      if (!exercise || !isEligible(exercise, request.equipment, request.avoid))
        swap(dayIndex, slotIndex, 'unavailable');
    }),
  );

  const byMuscle = new Map<MuscleId, { dayIndex: number; slotIndex: number }[]>();
  days.forEach((day, dayIndex) =>
    day.slots.forEach((slot, slotIndex) => {
      if (
        slot.lift !== undefined ||
        slot.locked ||
        rotations.some((r) => r.dayKey === day.key && r.slotKey === slot.key)
      ) {
        if (slot.lift !== undefined || slot.locked) {
          notes.push(
            explain('plan.slot.kept', {
              args: { slot: slot.key, exercise: slot.exerciseId, locked: slot.locked === true },
            }),
          );
        }
        return;
      }
      const muscle = parentMuscle(slot.targets[0] ?? ('mu.none' as MuscleId));
      byMuscle.set(muscle, [...(byMuscle.get(muscle) ?? []), { dayIndex, slotIndex }]);
    }),
  );
  for (const [, slots] of [...byMuscle].toSorted(([a], [b]) => compareIds(a, b))) {
    const wanted = Math.min(
      slots.length,
      perMuscle.value.max,
      Math.max(perMuscle.value.min, Math.ceil(slots.length / 2)),
    );
    let rotated = 0;
    for (const { dayIndex, slotIndex } of slots) {
      if (rotated >= wanted) break;
      if (swap(dayIndex, slotIndex, 'rotation')) rotated++;
    }
  }

  const targets = nextTargets(current.next?.targets ?? current.targets, input, rules, notes);
  const lifts = [
    ...new Set(days.flatMap((day) => day.slots.flatMap((slot) => (slot.lift ? [slot.lift] : [])))),
  ];
  const liftGoals =
    request.style === 'bodybuilding'
      ? []
      : liftTargets(lifts, request.level, rules).map((goal) => goal.value);
  const refilled = refill(days, targets, request, lookup, rules);

  const mesocycle: Mesocycle = {
    index: current.index + 1,
    startDate: input.startDate,
    accumulationWeeks:
      current.accumulationWeeks -
      (current.deload.postponed ? rules['deload.planned.postpone'].value.weeks : 0),
    deloadWeeks: current.deloadWeeks,
    status: 'planned',
    level: request.level,
    days: refilled,
    targets,
    liftTargets: liftGoals,
    deload: { postponed: false, skipped: false, broughtForward: false },
  };
  const report = validatePlan(
    refilled,
    {
      style: request.style,
      level: request.level,
      sessionMinutes: request.sessionMinutes,
      equipment: request.equipment,
      avoid: request.avoid,
      targets,
      liftTargets: liftGoals,
      accumulationWeeks: mesocycle.accumulationWeeks,
      deloadWeeks: mesocycle.deloadWeeks,
      exercise: lookup,
      exercises: catalog.exercises,
      restRules,
    },
    rules,
  );
  return explained({ mesocycle, rotations, report, notes }, 'plan.mesocycle', {
    args: { index: mesocycle.index, rotations: rotations.length, level: request.level },
    params: [perMuscle, rules['volume.startingVolume.maxFactor']],
    children: notes,
  });
}

/** PLN-03 targets for the next block: re-derived for the level, capped by logged volume × 1.2. */
function nextTargets(
  current: readonly MuscleTarget[],
  input: NextMesocycleInput,
  rules: PlanningRules,
  notes: Explanation[],
): MuscleTarget[] {
  const maintenance = new Set(
    current.filter((target) => target.source === 'maintenance').map((target) => target.muscle),
  );
  const fresh = new Map(
    muscleTargets(
      current.map((target) => target.muscle),
      { ...input.request, maintenance },
      rules,
    ).map((target) => [target.value.muscle, target.value]),
  );
  const floor = rules['volume.hypertrophy.weeklyBands'].value.floor;
  const maxFactor = rules['volume.startingVolume.maxFactor'];
  return current.map((target) => {
    const base = target.source === 'user' ? target : (fresh.get(target.muscle) ?? target);
    const achieved = input.logged?.get(target.muscle);
    if (achieved === undefined || achieved + 0.5 >= base.sets) return base;
    const sets = Math.max(
      floor,
      Math.min(base.sets, Math.round(achieved * maxFactor.value * 2) / 2),
    );
    notes.push(
      explain('plan.next.volume', {
        args: {
          muscle: target.muscle,
          planned: target.sets,
          logged: Math.round(achieved * 10) / 10,
          next: sets,
        },
        params: [maxFactor, rules['volume.hypertrophy.weeklyBands']],
      }),
    );
    return { muscle: target.muscle, sets, source: 'logged' as const };
  });
}

/** Hypertrophy slots back to the minimum, then the same allocation as a new plan. */
function refill(
  days: readonly PlanDay[],
  targets: readonly MuscleTarget[],
  request: PlanRequest,
  lookup: ExerciseLookup,
  rules: PlanningRules,
): PlanDay[] {
  const min = rules['planning.slot.sets'].value.min;
  const work: WorkDay[] = days.map((day) => ({
    key: day.key,
    slots: day.slots.flatMap((slot) => {
      const exercise = lookup(slot.exerciseId);
      if (!exercise) return [];
      const plan: PlanSlot =
        slot.goal === 'hypertrophy' && setsOf(slot.prescription) > min
          ? { ...slot, prescription: withSets(slot.prescription, min) }
          : slot;
      return [{ exercise, plan }];
    }),
  }));
  const targetMap = new Map(targets.map((target) => [target.muscle, target.sets]));
  allocateSets(
    new SetLedger(work, targetMap, request.sessionMinutes, rules),
    targetMap,
    request.priorities,
  );
  return days.map((day, index) => ({ ...day, slots: work[index]!.slots.map((slot) => slot.plan) }));
}

function withRepRange(
  prescription: Prescription,
  repRange: readonly [number, number],
): Prescription {
  switch (prescription.mode) {
    case 'doubleProgression':
    case 'rpe':
      return { ...prescription, repRange };
    default:
      return prescription;
  }
}
