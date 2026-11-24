/**
 * `@powr/domain/warmup`: the warm-up ramp generator (WKT-06; EB §Session › Warm-up). Rule 1 for
 * heavy work (≤ 5 reps or ≥ 80% e1RM): bar, 40/60/75/85%, plus a 92% single near a max. Rule 2
 * for compounds: bar, 50% × 6, 70% × 4 (85% × 2 optional). Rule 3 for isolation: one set at 50%,
 * and one feeder set at 70% for later exercises on a pattern that is already warm. Loads are
 * rounded to the equipment; steps at or below the previous one plus 5% of the working load, or at
 * or above the working load, are dropped; reps from 70% on stay below the working reps (singles
 * stay singles). The empty-bar set is only added for the first barbell exercise of a pattern.
 * Warm-up sets are excluded from every metric (set type `warmup`).
 */
import { explained, quantity, type Explained } from '../explain';
import { implementUnit, roundToAchievable, type Implement } from '../loading';
import type { Mechanics } from '../model';
import type { Param, RuleSlice, WarmupRamp, WarmupStep } from '../rules';
import { convertMass, toKg, type Mass, type RoundingMode } from '../units';

export type WarmupRules = RuleSlice<
  | 'session.warmup.heavyTrigger'
  | 'session.warmup.heavy'
  | 'session.warmup.compound'
  | 'session.warmup.isolation'
  | 'session.warmup.feeder'
  | 'session.warmup.pruning'
  | 'session.rest.warmupLight'
  | 'session.rest.warmupBeforeWork'
>;

export interface WarmupInput {
  readonly workingLoad: Mass;
  readonly workingReps: number;
  /** Current e1RM; without it only the rep count can make work "heavy". */
  readonly e1rmKg?: number | null;
  readonly mechanics: Mechanics;
  /** First exercise of the session for this movement pattern. */
  readonly firstForPattern: boolean;
  /** Add the ramp's optional steps (e.g. 85% × 2 on compounds). */
  readonly includeOptional?: boolean;
}

export interface WarmupSet {
  readonly load: Mass;
  readonly reps: number;
  /** The ramp's nominal percent of the working load (the empty bar: its actual percent). */
  readonly pct: number;
  /** Rest after this set. */
  readonly restSeconds: number;
}

type RampRule = 'warmup.heavy' | 'warmup.compound' | 'warmup.isolation' | 'warmup.feeder';

export function generateWarmup(
  input: WarmupInput,
  equipment: { readonly implement: Implement; readonly mode?: RoundingMode },
  rules: WarmupRules,
): Explained<readonly WarmupSet[]> {
  const { implement } = equipment;
  const unit = implementUnit(implement);
  const work = convertMass(input.workingLoad, unit);
  const e1rmKg = input.e1rmKg ?? 0;
  const pctE1rm = e1rmKg > 0 ? (toKg(input.workingLoad) / e1rmKg) * 100 : null;
  const trigger = rules['session.warmup.heavyTrigger'].value;
  const heavy =
    input.workingReps <= trigger.maxReps || (pctE1rm !== null && pctE1rm >= trigger.minPctE1rm);

  const [rule, rampParam] = selectRamp(heavy, input, rules);
  const ramp: WarmupRamp = rampParam.value;
  const steps: WarmupStep[] = [...ramp.steps];
  if (input.includeOptional) steps.push(...ramp.optional);
  if (rule === 'warmup.heavy') {
    const topUp = rules['session.warmup.heavy'].value.topUp;
    if (pctE1rm !== null && pctE1rm >= topUp.minPctE1rm) steps.push(topUp);
  }

  const pruning = rules['session.warmup.pruning'].value;
  const restLight = rules['session.rest.warmupLight'].value;
  const restLong = rules['session.rest.warmupBeforeWork'].value;
  const mode = equipment.mode ?? 'nearestTiesDown';
  const sets: WarmupSet[] = [];
  let previous = 0;

  const add = (load: number, reps: number, pct: number) => {
    const cappedReps =
      load >= (work * pruning.repCapFromPct) / 100 && reps >= input.workingReps
        ? Math.max(1, input.workingReps - 1)
        : reps;
    sets.push({
      load: { value: load, unit },
      reps: cappedReps,
      pct,
      restSeconds: pct >= pruning.longRestFromPct ? restLong : restLight,
    });
    previous = load;
  };

  if (implement.kind === 'barbell' && ramp.barReps !== null && input.firstForPattern) {
    const bar = roundToAchievable({ value: 0, unit }, implement, 'up').chosen?.load;
    if (bar !== undefined && bar > 0 && bar < work) add(bar, ramp.barReps, (bar / work) * 100);
  }
  for (const step of steps.toSorted((a, b) => a.pct - b.pct)) {
    const load = roundToAchievable({ value: (work * step.pct) / 100, unit }, implement, mode).chosen
      ?.load;
    if (load === undefined || load <= 0 || load >= work) continue;
    if (sets.length > 0 && load < previous + (work * pruning.minStepGapPct) / 100) continue;
    add(load, step.reps, step.pct);
  }

  return explained<readonly WarmupSet[]>(sets, sets.length > 0 ? rule : 'warmup.none', {
    args: { workingLoad: { mass: { value: work, unit } }, heavy, steps: sets.length },
    facts: [
      quantity('workingReps', input.workingReps),
      quantity('pctE1rm', pctE1rm),
      quantity('firstForPattern', input.firstForPattern),
    ],
    params: [
      rules['session.warmup.heavyTrigger'],
      rampParam,
      rules['session.warmup.pruning'],
      rules['session.rest.warmupLight'],
      rules['session.rest.warmupBeforeWork'],
    ],
  });
}

function selectRamp(
  heavy: boolean,
  input: WarmupInput,
  rules: WarmupRules,
): [RampRule, Param<WarmupRamp>] {
  return heavy
    ? ['warmup.heavy', rules['session.warmup.heavy']]
    : !input.firstForPattern
      ? ['warmup.feeder', rules['session.warmup.feeder']]
      : input.mechanics === 'compound'
        ? ['warmup.compound', rules['session.warmup.compound']]
        : ['warmup.isolation', rules['session.warmup.isolation']];
}
