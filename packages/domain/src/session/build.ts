/**
 * Building a session's planned side (WKT-01, WKT-06, WKT-09, PLN-15): from a planned session's
 * slots (prescriptions with the deload and return-from-break adjustments already applied by the
 * plan), from a past session (repeat), or freestyle exercises with the evidence defaults; and the
 * warm-up ramp of an exercise from its first working load (WKT-06).
 */
import type { ExerciseId } from '../ids';
import type {
  ExerciseDef,
  Goal,
  LoggedSet,
  PlannedSession,
  PlannedSet,
  PlanSlot,
  Prescription,
  RirRange,
  Session,
  SessionExercise,
} from '../model';
import type { RuleSet } from '../rules';
import { toKg } from '../units';
import { generateWarmup } from '../warmup';
import { currentE1rm, sortSets } from './history';
import { freshKey, isWorking } from './slots';
import { implementOf, loadless, suggestSet } from './suggest';
import type { SessionContext, SessionState } from './types';

/** Working sets of an exercise added on the fly or in a freestyle session (WKT-09, PLN-15). */
export const DEFAULT_ADDED_SETS = 3;

/** The planned sets a prescription asks for (warm-ups come separately). */
function work(count: number, set: Omit<PlannedSet, 'key'>): PlannedSet[] {
  return Array.from({ length: Math.max(0, count) }, () => ({ key: '', ...set }));
}

export function plannedSetsOf(prescription: Prescription): PlannedSet[] {
  let sets: PlannedSet[];
  switch (prescription.mode) {
    case 'doubleProgression':
    case 'rpe':
      sets = work(prescription.sets, {
        type: 'working',
        reps: prescription.repRange,
        rir: prescription.rir,
        load: null,
      });
      break;
    case 'topBackoff':
      sets = [
        ...work(1, {
          type: 'top',
          reps: prescription.top.repRange,
          rir: prescription.top.rir,
          load: null,
        }),
        ...work(prescription.backoff.sets, {
          type: 'backoff',
          reps: prescription.backoff.repRange,
          rir: prescription.backoff.rir,
          load: null,
        }),
      ];
      break;
    case 'percent':
      sets = work(prescription.sets, {
        type: 'working',
        reps: prescription.repRange,
        rir: null,
        load: null,
      });
      break;
    case 'fixed':
      sets = work(prescription.sets, {
        type: 'working',
        reps: [prescription.reps, prescription.reps],
        rir: null,
        load: prescription.load,
      });
      break;
    case 'amrap':
      sets = work(1, {
        type: 'amrap',
        reps: null,
        rir:
          prescription.stopAtRir === undefined
            ? null
            : [prescription.stopAtRir, prescription.stopAtRir],
        load: 'fixed' in prescription.load ? prescription.load.fixed : null,
      });
      break;
    case 'timed':
      sets = work(prescription.sets, {
        type: 'timed',
        reps: null,
        rir: null,
        load: null,
        durationS: prescription.durationS,
      });
      break;
    case 'technique':
      sets = work(prescription.base.sets, {
        type: 'working',
        reps: prescription.base.repRange,
        rir: prescription.base.rir,
        load: null,
        technique: { kind: prescription.technique },
      });
      break;
  }
  return sets.map((set, index) => ({ ...set, key: `s${index + 1}` }));
}

/** A slot of the plan as a session exercise. */
function exerciseFromPlanSlot(slot: PlanSlot, key: string): SessionExercise {
  return {
    key,
    exerciseId: slot.exerciseId,
    origin: 'plan',
    planSlotKey: slot.key,
    goal: slot.goal,
    priority: slot.priority,
    progression: slot.progression,
    prescription: slot.prescription,
    sets: plannedSetsOf(slot.prescription),
    restSeconds: slot.restSeconds,
    ...(slot.loadPct ? { loadPct: slot.loadPct } : {}),
    ...(slot.lift ? { lift: slot.lift } : {}),
    ...(slot.intensity ? { intensity: slot.intensity } : {}),
    skipped: false,
  };
}

/**
 * An exercise added on the fly or in a freestyle session: the exercise's rep range for its goal
 * (strength for competition lifts), the registry's effort band, `DEFAULT_ADDED_SETS` sets, the
 * main-lift model for competition lifts (by level) and double progression otherwise (PRG-04).
 */
export function addedExercise(
  exercise: ExerciseDef,
  key: string,
  rules: RuleSet,
  level: SessionContext['level'],
  sets: number = DEFAULT_ADDED_SETS,
): SessionExercise {
  const goal: Goal = exercise.competitionLift ? 'strength' : 'hypertrophy';
  const effort = goal === 'strength' ? rules['volume.effort.strengthRpe'].value.work : null;
  const rir: RirRange = effort
    ? [10 - effort.max, 10 - effort.min]
    : [
        rules['volume.effort.hypertrophyRir'].value.min,
        rules['volume.effort.hypertrophyRir'].value.max,
      ];
  const repRange = exercise.defaults.repRange[goal];
  const progression = exercise.competitionLift
    ? rules['progression.model.mainLift'].value[level]
    : rules['progression.model.accessory'].value;
  const prescription: Prescription =
    exercise.load.type === 'timed'
      ? { mode: 'timed', sets, durationS: 30 }
      : progression === 'rpe'
        ? { mode: 'rpe', sets, repRange, rir }
        : { mode: 'doubleProgression', sets, repRange, rir };
  return {
    key,
    exerciseId: exercise.id,
    origin: 'added',
    goal,
    priority: 'secondary',
    progression,
    prescription,
    sets: plannedSetsOf(prescription),
    restSeconds: null,
    ...(exercise.competitionLift ? { lift: exercise.competitionLift } : {}),
    skipped: false,
  };
}

/** The exercises of a past session for a repeat (WKT-01), with fresh planned sets. */
export function repeatedExercises(session: Session, sets: readonly LoggedSet[]): SessionExercise[] {
  if (session.exercises.length > 0) {
    return session.exercises.map((exercise) => ({
      ...exercise,
      origin: 'repeat',
      sets: exercise.sets.filter(isWorking),
      skipped: false,
    }));
  }
  // An M0 quick-log session: one slot per exercise, one planned set per logged working set.
  const order: ExerciseId[] = [];
  for (const set of sortSets(sets)) if (!order.includes(set.exerciseId)) order.push(set.exerciseId);
  return order.map((exerciseId, index) => {
    const own = sortSets(sets).filter(
      (set) => set.exerciseId === exerciseId && set.state === 'done' && set.type !== 'warmup',
    );
    return {
      key: `r${index + 1}`,
      exerciseId,
      origin: 'repeat',
      goal: 'hypertrophy',
      priority: 'secondary',
      progression: 'manual',
      prescription: null,
      sets: own.map((set, setIndex) => ({
        key: `s${setIndex + 1}`,
        type: set.type,
        reps: set.reps === null ? null : [set.reps, set.reps],
        rir: set.effort.rir === null ? null : [set.effort.rir, set.effort.rir],
        load: null,
      })),
      restSeconds: null,
      skipped: false,
    };
  });
}

/** Keys unique within the session (plan slot keys, suffixed on a clash). */
function uniqueKeys(exercises: readonly SessionExercise[]): SessionExercise[] {
  const used: string[] = [];
  return exercises.map((exercise) => {
    const key = used.includes(exercise.key) ? freshKey(used, `${exercise.key}.`) : exercise.key;
    used.push(key);
    return key === exercise.key ? exercise : { ...exercise, key };
  });
}

/** The planned slots of a planned session as session exercises. */
export function exercisesFromPlannedSession(planned: PlannedSession): SessionExercise[] {
  return uniqueKeys(planned.slots.map((slot) => exerciseFromPlanSlot(slot, slot.key)));
}

/**
 * WKT-06: the warm-up ramp of a slot from the suggested load of its first pending working set,
 * replacing pending warm-ups. Null when no working load is known yet (calibration without an
 * e1RM: the user picks the load) or the exercise carries no load.
 */
export function warmupsFor(
  state: SessionState,
  slotKey: string,
  ctx: SessionContext,
  includeOptional = false,
): PlannedSet[] | null {
  const index = state.session.exercises.findIndex((exercise) => exercise.key === slotKey);
  const slot = state.session.exercises[index];
  const exercise = slot && ctx.exercise(slot.exerciseId);
  if (!slot || !exercise || loadless(exercise) || exercise.load.bodyweightLoaded) return null;
  const first = slot.sets.find(isWorking);
  if (!first) return null;
  const withoutWarmups: SessionState = {
    ...state,
    session: {
      ...state.session,
      exercises: state.session.exercises.map((other) =>
        other.key === slotKey ? { ...other, sets: other.sets.filter(isWorking) } : other,
      ),
    },
  };
  const suggested = suggestSet(withoutWarmups, slotKey, first.key, ctx)?.value;
  if (!suggested?.load || suggested.load.value <= 0 || suggested.reps === null) return null;
  const equipment = ctx.equipment(slot.exerciseId);
  const firstForPattern = !state.session.exercises
    .slice(0, index)
    .some((other) => ctx.exercise(other.exerciseId)?.pattern === exercise.pattern);
  const e1rm = currentE1rm(ctx.history(slot.exerciseId));
  const ramp = generateWarmup(
    {
      workingLoad: suggested.load,
      workingReps: suggested.reps,
      e1rmKg: e1rm,
      mechanics: exercise.mechanics,
      firstForPattern,
      includeOptional,
    },
    { implement: implementOf(equipment, exercise), mode: equipment.mode },
    ctx.rules(slot.exerciseId),
  ).value;
  return ramp
    .filter((set) => toKg(set.load) > 0)
    .map((set, setIndex) => ({
      key: `w${setIndex + 1}`,
      type: 'warmup',
      reps: [set.reps, set.reps],
      rir: null,
      load: set.load,
      restSeconds: set.restSeconds,
    }));
}
