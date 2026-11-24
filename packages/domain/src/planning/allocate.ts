import { explained, type Explained } from '../explain';
import type { MuscleId } from '../ids';
import type {
  CompetitionLift,
  ExerciseDef,
  LiftTarget,
  MuscleTarget,
  PlanSlot,
  RecentVolume,
  SlotPriority,
} from '../model';
import type { Param, RuleSlice, TraineeLevel } from '../rules';
import { meanReps, setsOf, slotSeconds, withSets, type DurationRules } from './analysis';
import { compareIds, creditFor, groupCredits } from './credits';

export type TargetRules = RuleSlice<
  | 'volume.hypertrophy.weeklyBands'
  | 'volume.strength.weeklyHeavySetsPerLift'
  | 'volume.startingVolume.maxFactor'
  | 'volume.maintenance'
  | 'planning.volume.startPosition'
>;

/**
 * PLN-03 weekly targets for the display groups the hypertrophy slots train: the default band
 * (10–20 fractional sets) at the level's position (novices low, intermediate and advanced
 * mid-band), priority muscles high, de-prioritized muscles (only optional slots train them) at
 * maintenance (a third of their band target, at least the floor of 4). With reported recent
 * volume, start there and move toward the band by at most ×1.2 (`volume.startingVolume.maxFactor`),
 * within the floor and the high band (30).
 */
export function muscleTargets(
  muscles: readonly MuscleId[],
  input: {
    readonly level: TraineeLevel;
    readonly priorities: readonly MuscleId[];
    readonly recentVolume: readonly RecentVolume[];
    /** Muscles only optional slots train (PLN-03: "de-prioritized"). */
    readonly maintenance?: ReadonlySet<MuscleId>;
  },
  rules: TargetRules,
): Explained<MuscleTarget>[] {
  const bands = rules['volume.hypertrophy.weeklyBands'];
  const position = rules['planning.volume.startPosition'];
  const maxFactor = rules['volume.startingVolume.maxFactor'];
  const maintenance = rules['volume.maintenance'];
  const { floor, defaultLow, defaultHigh, highHigh } = bands.value;
  return [...new Set(muscles)].toSorted(compareIds).map((muscle) => {
    const priority = input.priorities.includes(muscle);
    const at = priority ? position.value.priority : position.value[input.level];
    const band = halfSets(defaultLow + at * (defaultHigh - defaultLow));
    const recent = input.recentVolume.find((entry) => entry.muscle === muscle);
    let sets = band;
    let source: MuscleTarget['source'] = priority ? 'priority' : 'band';
    const params: Param<unknown>[] = [bands, position];
    if (recent) {
      const moved =
        recent.sets >= band ? recent.sets : Math.min(band, recent.sets * maxFactor.value);
      sets = halfSets(Math.min(highHigh, Math.max(floor, moved)));
      source = 'recent';
      params.push(maxFactor);
    } else if (!priority && input.maintenance?.has(muscle)) {
      sets = Math.max(floor, halfSets(band * maintenance.value.volumeFraction));
      source = 'maintenance';
      params.push(maintenance);
    }
    return explained({ muscle, sets, source }, 'plan.volume.target', {
      args: { muscle, sets, source, level: input.level, recent: recent?.sets ?? null },
      params,
    });
  });
}

/** PLN-03 strength: weekly direct heavy sets per competition lift at the level's position. */
export function liftTargets(
  lifts: readonly CompetitionLift[],
  level: TraineeLevel,
  rules: TargetRules,
): Explained<LiftTarget>[] {
  const band = rules['volume.strength.weeklyHeavySetsPerLift'];
  const position = rules['planning.volume.startPosition'];
  return [...new Set(lifts)].toSorted(compareIds).map((lift) => {
    const heavySets = Math.round(
      band.value.min + position.value[level] * (band.value.max - band.value.min),
    );
    return explained({ lift, heavySets }, 'plan.volume.liftTarget', {
      args: { lift, heavySets, level },
      params: [band, position],
    });
  });
}

function halfSets(value: number): number {
  return Math.round(value * 2) / 2;
}

/** One slot while sets are being allocated: the plan slot and its exercise. */
export interface WorkSlot {
  readonly exercise: ExerciseDef;
  plan: PlanSlot;
}

export interface WorkDay {
  readonly key: string;
  readonly slots: WorkSlot[];
}

export type AllocationRules = DurationRules &
  RuleSlice<
    'volume.hypertrophy.perSessionSoftCap' | 'volume.hypertrophy.weeklyBands' | 'planning.slot.sets'
  >;

export type SetBlocker = 'slotLimit' | 'timeBudget' | 'sessionCap' | 'band';

/**
 * State for "may this slot get one more set?", shared by the allocator and the validator so the
 * two agree on what was achievable (PLN-01: flag only what the inputs make unavoidable).
 */
export class SetLedger {
  readonly days: readonly WorkDay[];
  private readonly targets: ReadonlyMap<MuscleId, number>;
  private readonly budgetMinutes: number | null;
  private readonly rules: AllocationRules;
  private readonly weekly = new Map<MuscleId, number>();
  private readonly daily: Map<MuscleId, { fractional: number; direct: number }>[];
  private readonly seconds: number[];

  constructor(
    days: readonly WorkDay[],
    targets: ReadonlyMap<MuscleId, number>,
    budgetMinutes: number | null,
    rules: AllocationRules,
  ) {
    this.days = days;
    this.targets = targets;
    this.budgetMinutes = budgetMinutes;
    this.rules = rules;
    this.daily = days.map(() => new Map());
    this.seconds = days.map((day) => daySeconds(day, rules));
    days.forEach((day, index) => {
      for (const slot of day.slots) this.count(index, slot, setsOf(slot.plan.prescription));
    });
  }

  /** The weekly floor (minimum detectable dose) of the hypertrophy bands. */
  get floor(): number {
    return this.rules['volume.hypertrophy.weeklyBands'].value.floor;
  }

  /** Weekly fractional sets of a display group. */
  fractional(muscle: MuscleId): number {
    return this.weekly.get(muscle) ?? 0;
  }

  /** Why one more set of this slot would break a limit, or null if it fits. */
  blocker(dayIndex: number, slot: WorkSlot): SetBlocker | null {
    if (slot.plan.goal !== 'hypertrophy') return 'slotLimit';
    if (setsOf(slot.plan.prescription) >= this.rules['planning.slot.sets'].value.max)
      return 'slotLimit';
    if (
      this.budgetMinutes !== null &&
      this.seconds[dayIndex]! + setSeconds(slot, this.rules) > this.budgetMinutes * 60
    ) {
      return 'timeBudget';
    }
    const cap = this.rules['volume.hypertrophy.perSessionSoftCap'].value;
    const day = this.daily[dayIndex]!;
    for (const [muscle, credit] of groupCredits(slot.exercise)) {
      const today = day.get(muscle) ?? { fractional: 0, direct: 0 };
      if (today.fractional + credit > cap.fractionalSets + 1e-9) return 'sessionCap';
      if (credit === 1 && today.direct + 1 > cap.directSets) return 'sessionCap';
    }
    const bands = this.rules['volume.hypertrophy.weeklyBands'].value;
    for (const [muscle, credit] of groupCredits(slot.exercise)) {
      const target = this.targets.get(muscle);
      if (target === undefined) continue;
      if (this.fractional(muscle) + credit > Math.max(target, bands.defaultHigh) + 1e-9)
        return 'band';
    }
    return null;
  }

  /** Adds one set to a slot and updates the totals. */
  add(dayIndex: number, slot: WorkSlot): void {
    this.seconds[dayIndex]! += setSeconds(slot, this.rules);
    slot.plan = {
      ...slot.plan,
      prescription: withSets(slot.plan.prescription, setsOf(slot.plan.prescription) + 1),
    };
    this.count(dayIndex, slot, 1);
  }

  private count(dayIndex: number, slot: WorkSlot, sets: number): void {
    const day = this.daily[dayIndex]!;
    for (const [muscle, credit] of groupCredits(slot.exercise)) {
      this.weekly.set(muscle, this.fractional(muscle) + sets * credit);
      const today = day.get(muscle) ?? { fractional: 0, direct: 0 };
      today.fractional += sets * credit;
      if (credit === 1) today.direct += sets;
      day.set(muscle, today);
    }
  }
}

/** Seconds one more working set adds: its reps and the rest before it (PLN-14). */
function setSeconds(slot: WorkSlot, rules: DurationRules): number {
  return (
    meanReps(slot.plan.prescription) * rules['session.duration.repSeconds'].value +
    slot.plan.restSeconds
  );
}

/** Estimated seconds of a day (the same model as `dayMinutes`). */
export function daySeconds(day: WorkDay, rules: DurationRules): number {
  const warm = new Set<string>();
  let seconds = 0;
  for (const slot of day.slots) {
    seconds += slotSeconds(slot.plan, slot.exercise, warm.has(slot.exercise.pattern), rules);
    warm.add(slot.exercise.pattern);
  }
  return seconds;
}

const PRIORITY_RANK: Readonly<Record<SlotPriority, number>> = {
  primary: 0,
  secondary: 1,
  optional: 2,
};

/**
 * §8.7.6 step 4: adds hypertrophy sets one at a time where they close the largest weekly
 * deficit against the targets, as long as the slot stays within its set limit, the day within
 * the time budget and the per-session soft cap (~11 fractional, ~8 direct sets per muscle) and
 * no target muscle above its band. Ties go to primary slots, slots for a priority muscle, then
 * the earlier day and slot. Deterministic.
 */
export function allocateSets(
  ledger: SetLedger,
  targets: ReadonlyMap<MuscleId, number>,
  priorities: readonly MuscleId[],
): number {
  // The credit each slot gives each target muscle, computed once.
  const credits = new Map<WorkSlot, [MuscleId, number, number][]>();
  for (const day of ledger.days) {
    for (const slot of day.slots) {
      credits.set(
        slot,
        [...targets].flatMap(([muscle, target]) => {
          const credit = creditFor(slot.exercise, muscle);
          return credit > 0 ? [[muscle, credit, target] as [MuscleId, number, number]] : [];
        }),
      );
    }
  }
  const floor = ledger.floor;
  let added = 0;
  for (;;) {
    let best: { day: number; slot: WorkSlot; gain: number; rank: number[] } | null = null;
    ledger.days.forEach((day, dayIndex) => {
      day.slots.forEach((slot, slotIndex) => {
        let gain = 0;
        for (const [muscle, credit, target] of credits.get(slot) ?? []) {
          gain += shortfall(ledger.fractional(muscle), target, floor, credit);
        }
        if (gain <= 1e-9 || ledger.blocker(dayIndex, slot) !== null) return;
        const rank = [
          -gain,
          PRIORITY_RANK[slot.plan.priority],
          slot.plan.targets.some((target) => priorities.includes(target)) ? 0 : 1,
          dayIndex,
          slotIndex,
        ];
        if (best === null || lexLess(rank, best.rank)) best = { day: dayIndex, slot, gain, rank };
      });
    });
    if (best === null) return added;
    const chosen: { day: number; slot: WorkSlot } = best;
    ledger.add(chosen.day, chosen.slot);
    added++;
  }
}

/**
 * Sets still missing to reach `target` from `current`, the part below the floor (4, the
 * minimum detectable dose) counted twice, so floors are reached first. With `step`, only what
 * one more set of that credit closes.
 */
function shortfall(current: number, target: number, floor: number, step = Infinity): number {
  return (
    Math.min(step, Math.max(0, target - current)) + Math.min(step, Math.max(0, floor - current))
  );
}

/** Σ over target muscles of the sets still missing (below-floor sets counted twice). */
export function totalDeficit(ledger: SetLedger, targets: ReadonlyMap<MuscleId, number>): number {
  let deficit = 0;
  for (const [muscle, target] of targets)
    deficit += shortfall(ledger.fractional(muscle), target, ledger.floor);
  return deficit;
}

function lexLess(a: readonly number[], b: readonly number[]): boolean {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i]! - b[i]!) > 1e-9) return a[i]! < b[i]!;
  }
  return false;
}
