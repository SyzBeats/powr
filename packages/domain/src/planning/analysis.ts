import { explained, type Explained } from '../explain';
import type { MuscleId } from '../ids';
import type {
  CompetitionLift,
  ExerciseDef,
  LiftTarget,
  MuscleTarget,
  PlanDay,
  PlanSlot,
  Prescription,
  RirRange,
} from '../model';
import type { RuleSlice } from '../rules';
import { classifyWeeklyVolume } from '../volume';
import { compareIds, groupCredits, liftOf, type ExerciseLookup } from './credits';
import type { DayWeek, LiftWeek, MuscleWeek, WeekAnalysis } from './types';

/** Working sets of a prescription (top set included). */
export function setsOf(prescription: Prescription): number {
  switch (prescription.mode) {
    case 'topBackoff':
      return 1 + prescription.backoff.sets;
    case 'amrap':
      return 1;
    case 'technique':
      return prescription.base.sets;
    default:
      return prescription.sets;
  }
}

/** A copy of the prescription with `sets` working sets (top set kept for top + back-offs). */
export function withSets(prescription: Prescription, sets: number): Prescription {
  const n = Math.max(1, Math.round(sets));
  switch (prescription.mode) {
    case 'topBackoff':
      return { ...prescription, backoff: { ...prescription.backoff, sets: Math.max(0, n - 1) } };
    case 'amrap':
      return prescription;
    case 'technique':
      return { ...prescription, base: { ...prescription.base, sets: n } };
    default:
      return { ...prescription, sets: n };
  }
}

const mid = (range: readonly [number, number]) => (range[0] + range[1]) / 2;

/** Mean planned reps per working set (the midpoint of each rep range). */
export function meanReps(prescription: Prescription): number {
  switch (prescription.mode) {
    case 'topBackoff': {
      const sets = 1 + prescription.backoff.sets;
      return (
        (mid(prescription.top.repRange) +
          prescription.backoff.sets * mid(prescription.backoff.repRange)) /
        sets
      );
    }
    case 'fixed':
      return prescription.reps;
    case 'timed':
      return 0;
    case 'amrap':
      return 10;
    case 'technique':
      return mid(prescription.base.repRange);
    default:
      return mid(prescription.repRange);
  }
}

/** The RIR ranges a prescription asks for (empty when it states none). */
export function rirRangesOf(prescription: Prescription): readonly RirRange[] {
  switch (prescription.mode) {
    case 'topBackoff':
      return [prescription.top.rir, prescription.backoff.rir];
    case 'doubleProgression':
    case 'rpe':
      return [prescription.rir];
    case 'technique':
      return [prescription.base.rir];
    default:
      return [];
  }
}

/** The rep ranges a prescription asks for. */
export function repRangesOf(prescription: Prescription): readonly (readonly [number, number])[] {
  switch (prescription.mode) {
    case 'topBackoff':
      return [prescription.top.repRange, prescription.backoff.repRange];
    case 'fixed':
      return [[prescription.reps, prescription.reps]];
    case 'timed':
    case 'amrap':
      return [];
    case 'technique':
      return [prescription.base.repRange];
    default:
      return [prescription.repRange];
  }
}

export type HeavySetRules = RuleSlice<'volume.repRange.strength'>;

/**
 * Direct heavy sets of a slot for its competition lift (PLN-03: ≥ 80% 1RM, 1–6 reps): the sets
 * of a strength-goal slot that holds the lift or a close variant, prescribed at no more than the
 * strength main-work reps, on a heavy or moderate day. Light days are submaximal practice
 * (EB §Monitoring › Recovery: "near-daily submaximal practice is fine") and count for frequency only.
 */
export function heavySets(
  slot: PlanSlot,
  exercise: ExerciseDef,
  lookup: ExerciseLookup,
  rules: HeavySetRules,
): { readonly lift: CompetitionLift; readonly sets: number } | null {
  const lift = liftOf(exercise, lookup);
  if (lift === undefined || slot.goal !== 'strength' || slot.intensity === 'light') return null;
  const maxReps = rules['volume.repRange.strength'].value.main.max;
  const ranges = repRangesOf(slot.prescription);
  if (ranges.length === 0 || ranges.some((range) => range[1] > maxReps)) {
    if (slot.prescription.mode !== 'topBackoff') return { lift, sets: 0 };
    // Top set heavy, back-offs lighter: only the top set counts.
    return { lift, sets: slot.prescription.top.repRange[1] <= maxReps ? 1 : 0 };
  }
  return { lift, sets: setsOf(slot.prescription) };
}

export type DurationRules = RuleSlice<
  | 'session.duration.repSeconds'
  | 'session.duration.warmupSetSeconds'
  | 'session.duration.transitionSeconds'
  | 'session.warmup.heavy'
  | 'session.warmup.compound'
  | 'session.warmup.isolation'
  | 'session.warmup.feeder'
>;

/**
 * Seconds one slot takes (PLN-14, EB §Session › Duration): reps × rep duration and the rest
 * between working sets, plus its warm-up sets (heavy ramp for main lifts, compound or isolation
 * ramp, feeder sets for a later exercise of a pattern already warm) and one transition.
 */
export function slotSeconds(
  slot: PlanSlot,
  exercise: ExerciseDef,
  warm: boolean,
  rules: DurationRules,
): number {
  const sets = setsOf(slot.prescription);
  const reps = meanReps(slot.prescription);
  const work =
    slot.prescription.mode === 'timed'
      ? sets * slot.prescription.durationS
      : sets * reps * rules['session.duration.repSeconds'].value;
  const rest = Math.max(0, sets - 1) * slot.restSeconds;
  const ramp = warm
    ? rules['session.warmup.feeder'].value
    : slot.lift !== undefined && slot.intensity !== 'light'
      ? rules['session.warmup.heavy'].value
      : exercise.mechanics === 'compound'
        ? rules['session.warmup.compound'].value
        : rules['session.warmup.isolation'].value;
  const warmupSets =
    ramp.steps.length + (ramp.barReps !== null && exercise.load.type === 'barbell' ? 1 : 0);
  return (
    work +
    rest +
    warmupSets * rules['session.duration.warmupSetSeconds'].value +
    rules['session.duration.transitionSeconds'].value
  );
}

/** Estimated minutes of one day (PLN-14), explained per slot. */
export function dayMinutes(
  day: PlanDay,
  lookup: ExerciseLookup,
  rules: DurationRules,
): Explained<number> {
  const seen = new Set<string>();
  let seconds = 0;
  for (const slot of day.slots) {
    const exercise = lookup(slot.exerciseId);
    if (!exercise) continue;
    seconds += slotSeconds(slot, exercise, seen.has(exercise.pattern), rules);
    seen.add(exercise.pattern);
  }
  const minutes = seconds / 60;
  return explained(minutes, 'plan.duration', {
    args: { dayKey: day.key, minutes: Math.round(minutes) },
    params: [
      rules['session.duration.repSeconds'],
      rules['session.duration.warmupSetSeconds'],
      rules['session.duration.transitionSeconds'],
    ],
  });
}

export type AnalysisRules = DurationRules &
  HeavySetRules &
  RuleSlice<'volume.hypertrophy.weeklyBands'>;

/**
 * The numbers of a week template (PLN-09 live panel): fractional and direct sets per display
 * group against its target, heavy sets and sessions per competition lift, and minutes, sets and
 * per-muscle volume per day. Planned sets are working sets, so each counts as one hard set.
 */
export function analyzeWeek(
  days: readonly PlanDay[],
  lookup: ExerciseLookup,
  targets: readonly MuscleTarget[],
  liftTargets: readonly LiftTarget[],
  rules: AnalysisRules,
): WeekAnalysis {
  const weekly = new Map<MuscleId, { fractional: number; direct: number; days: number }>();
  const lifts = new Map<CompetitionLift, { heavySets: number; days: number }>();
  const dayWeeks: DayWeek[] = [];

  for (const day of days) {
    const muscles = new Map<MuscleId, { fractional: number; direct: number }>();
    const heavy = new Map<CompetitionLift, number>();
    const liftDays = new Set<CompetitionLift>();
    let workingSets = 0;
    for (const slot of day.slots) {
      const exercise = lookup(slot.exerciseId);
      if (!exercise) continue;
      const sets = setsOf(slot.prescription);
      workingSets += sets;
      for (const [muscle, credit] of groupCredits(exercise)) {
        const total = muscles.get(muscle) ?? { fractional: 0, direct: 0 };
        total.fractional += sets * credit;
        if (credit === 1) total.direct += sets;
        muscles.set(muscle, total);
      }
      const lift = liftOf(exercise, lookup);
      if (lift !== undefined) liftDays.add(lift);
      const heavyPart = heavySets(slot, exercise, lookup, rules);
      if (heavyPart) heavy.set(heavyPart.lift, (heavy.get(heavyPart.lift) ?? 0) + heavyPart.sets);
    }
    for (const [muscle, total] of muscles) {
      const week = weekly.get(muscle) ?? { fractional: 0, direct: 0, days: 0 };
      week.fractional += total.fractional;
      week.direct += total.direct;
      if (total.fractional >= 1) week.days += 1;
      weekly.set(muscle, week);
    }
    for (const lift of liftDays) {
      const week = lifts.get(lift) ?? { heavySets: 0, days: 0 };
      week.days += 1;
      week.heavySets += heavy.get(lift) ?? 0;
      lifts.set(lift, week);
    }
    dayWeeks.push({
      dayKey: day.key,
      weekday: day.weekday,
      minutes: dayMinutes(day, lookup, rules).value,
      workingSets,
      exercises: day.slots.length,
      muscles: [...muscles]
        .toSorted(([a], [b]) => compareIds(a, b))
        .map(([muscle, total]) => ({ muscle, ...total })),
      heavySets: [...heavy]
        .toSorted(([a], [b]) => compareIds(a, b))
        .map(([lift, sets]) => ({ lift, sets })),
    });
  }

  const targetOf = new Map(targets.map((target) => [target.muscle, target.sets]));
  for (const target of targets) {
    if (!weekly.has(target.muscle))
      weekly.set(target.muscle, { fractional: 0, direct: 0, days: 0 });
  }
  const muscles: MuscleWeek[] = [...weekly]
    .toSorted(([a], [b]) => compareIds(a, b))
    .map(([muscle, week]) => ({
      muscle,
      fractional: week.fractional,
      direct: week.direct,
      target: targetOf.get(muscle) ?? null,
      band: classifyWeeklyVolume(week.fractional, rules).value,
      sessions: week.days,
    }));
  const liftTargetOf = new Map(liftTargets.map((target) => [target.lift, target.heavySets]));
  const liftWeeks: LiftWeek[] = [...lifts]
    .toSorted(([a], [b]) => compareIds(a, b))
    .map(([lift, week]) => ({
      lift,
      heavySets: week.heavySets,
      sessions: week.days,
      target: liftTargetOf.get(lift) ?? null,
    }));
  return { muscles, lifts: liftWeeks, days: dayWeeks };
}
