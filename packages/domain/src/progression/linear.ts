import { explained, quantity, type Explained, type Explanation } from '../explain';
import { roundToAchievable, roundingExplanation, implementUnit } from '../loading';
import type { Param, RuleSlice, TraineeLevel } from '../rules';
import { convertMass, fromKg, type Mass } from '../units';
import type { BodyRegion, LoadSuggestion, SuggestionEquipment } from './types';

export type LinearRules = RuleSlice<
  | 'progression.increment.noviceLowerKg'
  | 'progression.increment.noviceUpperKg'
  | 'progression.increment.intermediatePctPerWeek'
  | 'progression.increment.advancedLoadJumpWeeks'
  | 'progression.stall.failedSessions'
  | 'progression.stall.resetPct'
>;

export interface LinearInput {
  readonly lastLoad: Mass;
  readonly reps: number;
  /** Whether the prescribed reps were achieved, oldest session first. */
  readonly recentSessions: readonly boolean[];
  readonly level: TraineeLevel;
  readonly region: BodyRegion;
}

/**
 * Linear progression with the stall rule (PRG-06, PRG-07): after a successful session the load
 * rises by the level's increment, rounded up to an achievable load (microplates are used when
 * the inventory has them); after a miss the load is repeated; after the registry's number of
 * missed sessions in a row it resets by the registry percentage ([PRACT] convention). Advanced
 * lifters keep the load: they progress through reps, sets and RPE.
 * Call it per session for novices and per week for intermediates (the increment is per week).
 */
export function suggestLinear(
  input: LinearInput,
  equipment: SuggestionEquipment,
  rules: LinearRules,
): Explained<LoadSuggestion> {
  const unit = implementUnit(equipment.implement);
  const last = convertMass(input.lastLoad, unit);
  const failedNeeded = rules['progression.stall.failedSessions'].value;
  const recent = input.recentSessions.slice(-failedNeeded);
  const lastSuccess = input.recentSessions.findLastIndex((ok) => ok);
  const facts = [
    quantity('lastSessionMet', input.recentSessions.at(-1) ?? null),
    quantity('missedInARow', input.recentSessions.length - 1 - lastSuccess),
  ];

  if (recent.length >= failedNeeded && recent.every((ok) => !ok)) {
    const resetPct = rules['progression.stall.resetPct'].value;
    return rounded(
      'reset',
      last * (1 - resetPct / 100),
      'progression.linear.stallReset',
      { resetPct, failedSessions: failedNeeded },
      [rules['progression.stall.failedSessions'], rules['progression.stall.resetPct']],
    );
  }
  if (input.recentSessions.at(-1) === false) {
    return explained<LoadSuggestion>(
      { action: 'hold', load: { value: last, unit }, reps: input.reps, rounding: null },
      'progression.linear.retry',
      { args: { load: { mass: { value: last, unit } } }, facts },
    );
  }

  const increment = incrementFor(input.level, input.region, last, unit, rules);
  if (increment === null) {
    return explained<LoadSuggestion>(
      { action: 'hold', load: { value: last, unit }, reps: input.reps, rounding: null },
      'progression.linear.advancedHold',
      { facts, params: [rules['progression.increment.advancedLoadJumpWeeks']] },
    );
  }
  return rounded(
    'increase',
    last + increment.amount,
    'progression.linear.increase',
    { increment: { mass: { value: increment.amount, unit } }, level: input.level },
    [increment.param],
  );

  function rounded(
    action: LoadSuggestion['action'],
    target: number,
    rule: 'progression.linear.stallReset' | 'progression.linear.increase',
    args: Record<string, string | number | { mass: Mass }>,
    params: readonly Param<unknown>[],
  ): Explained<LoadSuggestion> {
    // Increases round up (never less than the increment), resets round down.
    const mode = action === 'increase' ? 'up' : 'down';
    const rounding = roundToAchievable({ value: target, unit }, equipment.implement, mode);
    const load = { value: rounding.chosen?.load ?? target, unit };
    const children: Explanation[] = [roundingExplanation(rounding)];
    return explained<LoadSuggestion>({ action, load, reps: input.reps, rounding }, rule, {
      args: { ...args, from: { mass: { value: last, unit } }, to: { mass: load } },
      facts,
      params,
      children,
    });
  }
}

/** The level's load increment in `unit`; null for advanced lifters. */
function incrementFor(
  level: TraineeLevel,
  region: BodyRegion,
  lastLoad: number,
  unit: Mass['unit'],
  rules: LinearRules,
): { amount: number; param: Param<number> } | null {
  if (level === 'novice') {
    const param =
      region === 'lower'
        ? rules['progression.increment.noviceLowerKg']
        : rules['progression.increment.noviceUpperKg'];
    return { amount: fromKg(param.value, unit), param };
  }
  if (level === 'intermediate') {
    const param = rules['progression.increment.intermediatePctPerWeek'];
    return { amount: (lastLoad * param.value) / 100, param };
  }
  return null;
}
